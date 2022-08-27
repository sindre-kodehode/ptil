"use strict"

import axios     from "axios";
import fs        from "fs/promises";
import { JSDOM } from "jsdom";

/*******************************************************************************
*  Point                                                                       *
*******************************************************************************/
class Point {
  constructor( type, html ) {
    this.type          = type;
    this.html          = html;
    this.description   = "";
    this.justification = "";
    this.legalBasis    = "";

    let curr = this.html.firstElementChild;
    this.topic = curr.textContent.trim();
    
    curr = curr.nextElementSibling;
    curr = curr.nextElementSibling;

    while( curr && curr.textContent !== "Begrunnelse" ) {
      this.description += curr.textContent.trim();
      curr = curr.nextElementSibling;
    }

    curr = curr.nextElementSibling;

    while( curr && curr.textContent !== "Hjemmel" ) {
      this.justification += curr.textContent.trim().replace( /"|"/g, "'" );
      curr = curr.nextElementSibling;
    }
    
    if ( curr ) {
      curr = curr.nextElementSibling;

      [ ...curr.children ].forEach( e =>
        this.legalBasis += `${ e.querySelector( "p" ).textContent.trim() }`
      );
    }
  };
}

/*******************************************************************************
*  Report                                                                      *
*******************************************************************************/
class Report {
  constructor( url, date ) {
    this.url  = url;
    this.date = date.toLocaleDateString( "en-US" );
  }

  fetch = async () => {
    console.log( `INFO  : fetching report: ${ this.url.pathname }` );
    const res = await axios.get( this.url.toString() );
    this.doc  = new JSDOM( res.data ).window.document;
  };

  parse = () => {
    this.title = this.doc
    .querySelector( ".header-articler" )
    .textContent
    .replace( /–|–/g, "-" )
    .trim()

    console.log( `INFO  : parsing : ${ this.title }` );

    const h = this.title.split( "-" );
    [ this.company, this.unit, ...this.category ] = 
      h.length > 2 ?  h : [ h[ 0 ], "", h[ 1 ] ];

    this.category = this.category.join( "-" ).trim();

    this.points = [
      ...[ ...this.doc.querySelectorAll( '[id^="deviation"].tab-pane' ) ]
        .map( html => new Point( "Avvik", html ) ),
      ...[ ...this.doc.querySelectorAll( '[id^="improvementPoint"].tab-pane' ) ]
        .map( html => new Point( "Forbedringspunkt", html ) )
    ]

    this.attachments = 
      [ ...this.doc.querySelectorAll( '[aria-label="Vedlegg"] a' ) ]
      .map( a => this.url.origin + a.href )
      .join( "\n" );
  };

  print = () => this.points
    .map( point => [
      `"${ this.title }"`,
      `"${ this.date }"`,
      `"${ this.company }"`,
      `"${ this.unit }"`,
      `"${ this.category }"`,
      `"${ point.type  }"`,
      `"${ point.topic}"`,
      `"${ point.description }"`,
      `"${ point.justification }"`,
      `"${ point.legalBasis }"`,
      `"${ this.url.href }"`,
      `"${ this.attachments }"`,
    ].join( ";" ) + "\n" ).join( "" );
}

/*******************************************************************************
*  ReportList                                                                  *
*******************************************************************************/
class ReportList extends Array {
  constructor( type ) {
    super()
    this.type = type;
    this.url = new URL( `https://www.ptil.no/tilsyn/${ this.type }srapporter/` );
  };

  fetch = async () => {
    const res  = await axios.get( this.url.toString() );
    const doc  = new JSDOM( res.data ).window.document;
    const data = [ ...doc.querySelectorAll( "#list-page-result a.pcard" ) ];

    this.push( ...data.map( card => new Report(
      new URL( `${ this.url.origin }${ card.href }` ),
      new Date( card.querySelector( "time" ).dateTime )
    )));
  };

  fetchReports = async () => { for ( const r of this ) await r.fetch(); };
  parseReports =       () => { for ( const r of this )       r.parse(); };

  writeFile = async () => {
    const headers = 
      "Tittel;" +
      "Publisert;" +
      "Selskap;" +
      "Enhet;" +
      "Kategori;" +
      "Avvik / Forbedringspunkt;" +
      "Tema;" +
      "Beskrivelse;" +
      "Begrunnelse;" +
      "Krav;" +
      "Nettside;" +
      "Vedlegg\n"

    const data = this.reduce( ( data, report ) => data += report.print(), "" )
    await fs.writeFile( `./${ this.type }.csv`, headers + data );
  };
}

/*******************************************************************************
*  ptil                                                                        *
*******************************************************************************/
try {
  const tilsynReports = new ReportList( "tilsyn" );
  const granskReports = new ReportList( "gransking" );

  console.log( "BEGIN : fetching latest reports" );
  await tilsynReports.fetch();
  await granskReports.fetch();

  console.log( "INFO  : fetching tilsyn reports" );
  await tilsynReports.fetchReports();

  console.log( "INFO  : fetching gransking reports" );
  await granskReports.fetchReports();

  console.log( "INFO  : parsing tilsyn reports" );
  tilsynReports.parseReports();

  console.log( "INFO  : parsing gransking reports" );
  granskReports.parseReports();

  console.log( "INFO  : writing to file" );
  await tilsynReports.writeFile();
  await granskReports.writeFile();

  console.log( "END   : successfully completed" );
  process.exit( 0 );
}
catch ( err ) {
  console.log( "ERROR : error while running, read ptil.error.log" );
  await fs.writeFile( "./ptil.error.log", JSON.stringify( err, null, 2 ) );
  process.exit( 1 );
}
