#! /usr/bin/env node
"use strict"


/*******************************************************************************
*  imports                                                                     *
*******************************************************************************/
import { readFile } from "node:fs/promises";
import { JSDOM }    from "jsdom";
import Excel        from "exceljs";


/*******************************************************************************
*  ptil.js                                                                     *
*******************************************************************************/
process.argv[2] ? readFromFile( process.argv[2] ) : fetchLatest();

async function readFromFile( filename ) {
  console.log( "reading from file" );
  const fd = await readFile( filename );

  console.log( "parsing report" );
  const entries = parseReport( fd.toString() );

  console.log( "writing to excel" );
  await writeToExcel( entries );
}

async function fetchLatest() {
  const base = "https://www.ptil.no"
  const url  = base + "/tilsyn/tilsynsrapporter/"

  console.log( "fetching latest" );
  const latest  = await fetch( url );
  const content = await latest.text();

  parseList( content );
}


/*******************************************************************************
*  parseList:                                                                  *
*******************************************************************************/
async function parseList( content ) {
  const dom     = new JSDOM( content );
  const search  = "#list-page-result a.pcard"; 
  const results = dom.window.document.querySelectorAll( search );

  console.log( `found ${results.length} reports` );
  const baseUrl = "https://www.ptil.no";

  console.log( "fetching reports" );
  const responses = await Promise.all( 
    [...results].map( result => fetch( baseUrl + result.href
  )));

  const reports = await Promise.all(
    responses.map( response => response.text()
  ));

  console.log( "parsing reports" );
  const entries = reports.map( report => parseReport( report ) );

  console.log( "writing to excel" );
  await writeToExcel( entries.flat() );
}


/*******************************************************************************
*  parseReport:                                                                *
*******************************************************************************/
function parseReport( content ) {
  const dom = new JSDOM( content );

  const header = 
    dom.window.document
    .querySelector( ".header-articler" )
    .textContent
    .trim()
    .replace("–", "-")
    .replace( "–", "-" )
    .split( "-" );

  const date =
    dom.window.document
    .querySelector( ".mb-3" )
    .textContent
    .split( ":" )[1]
    .trim();

  const company = header[0].trim();
  const topic   = header[2] ? header[2].trim() : header[1].trim();
  const unit    = header[2] ? header[1].trim() : "";

  const entries = [];

  const deviations =
    dom.window.document
    .querySelectorAll( "#collapseDeviations .tab-pane" );

  const improvements =
    dom.window.document
    .querySelectorAll( "#collapseImprovementPoints .tab-pane" );

  makeObjects( deviations,   "Avvik"            );
  makeObjects( improvements, "Forbedringspunkt" );

  function makeObjects( arr, type ) {
    arr.forEach( e => {
      let curr = e.firstElementChild;
      const title = curr.textContent.trim();

      curr = curr.nextElementSibling;
      curr = curr.nextElementSibling;

      let description = "";
      while( curr.textContent !== "Begrunnelse" ) {
        description += curr.textContent;
        curr = curr.nextElementSibling;
      }

      curr = curr.nextElementSibling;

      let justification = "";
      while( curr.textContent !== "Hjemmel" ) {
        justification += curr.textContent;
        curr = curr.nextElementSibling;
      }

      curr = curr.nextElementSibling;

      let legalBasis = "";
      [ ...curr.children ].forEach( e =>
        legalBasis += `${e.querySelector( "p" ).textContent}\n`
      );

      entries.push([
        ``,
        `${date}`,
        `${company}`,
        `${unit}`,
        `${topic}`,
        `${type}`,
        `${title}`,
        `${description.trim()}`,
        `${justification.trim()}`,
        `${legalBasis.trim()}`,
      ]);
    });
  }

  if ( entries[0] ) {
    entries[0][0] =
      dom.window.document
      .querySelector( "div.d-flex:nth-child(2) > h3:nth-child(1)" )
      .textContent
      .replace( / \(PDF\)$/, "" );
  }

  return entries;
}


/*******************************************************************************
*  writeToExcel:                                                               *
*******************************************************************************/
async function writeToExcel( entries ) {
  const workbook = new Excel.Workbook();
  await workbook.xlsx.readFile( "ptil.xlsx" );

  const worksheet = workbook.worksheets[0];
  worksheet.addRows( entries );

  await workbook.xlsx.writeFile( "test.xlsx" );
}
