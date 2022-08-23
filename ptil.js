"use strict"
/*******************************************************************************
*  imports                                                                     *
*******************************************************************************/
import * as fs    from "fs/promises";
import * as jsdom from "jsdom"      ;
import axios      from "axios"      ;
import exceljs    from "exceljs"    ;


/*******************************************************************************
*  ptil.js:                                                                    *
*******************************************************************************/
try {
  // read config
  const configFile = await fs.readFile( "./ptil.json", "utf8" );
  const config     = JSON.parse( configFile );
  await log( "INFO  : successfully read config ptil.json" );

  // fetch latest from tilsyn site
  await log( "INFO  : fetching latest tilsyn"  );
  const tilsynReq = await axios.get( config.tilsynLatest );
  const tilsynDoc = new jsdom.JSDOM( tilsynReq.data ).window.document;
  const tilsynRes = tilsynDoc.querySelectorAll( "#list-page-result a.pcard" );

  // filter out old reports
  await log( "INFO  : filtering out old reports" );
  const tilsynInfo =
    [ ...tilsynRes ]
    .map( res => ({
      href : res.href,
      date : new Date( res.querySelector( "time" ).dateTime )
    }))
    .filter( res => 
      res.date > new Date( config.lastUpdated )
  );

  // fetch individual reports
  await log( `INFO  : found ${ tilsynInfo.length } new tilsyn report(s)` );
  const tilsynReports = await Promise.all( tilsynInfo.map( info =>
      axios.get( `${ config.baseUrl }${ info.href }` ) )
  );

  // parse fetched reports
  await log( "INFO  : parsing reports" );
  const tilsynEntries = tilsynReports.reverse().map( report =>
    parseReport( report.data )
  );

  // write to excel
  await log( "INFO  : writing to excel" );
  const workbook = new exceljs.Workbook();
  await workbook.xlsx.readFile( config.tilsynDb );

  const worksheet = workbook.worksheets[0];
  worksheet.addRows( tilsynEntries.flat() );

  await workbook.xlsx.writeFile( config.tilsynDb );
  await log( "INFO  : successfully written to excel file" );

  // update config
  const newConfig = { ...config, lastUpdated : new Date().toISOString() };
  await fs.writeFile( "./ptil.json", JSON.stringify( newConfig, null, 2 ) );
  await log( "INFO  : successfully updated config" );

  // exit with no errors
  process.exit( 0 );
}
catch ( err ) {
  await log( `ERROR : ${ err.message }` );
  process.exit( 1 );
}


/*******************************************************************************
*  log:                                                                        *
*******************************************************************************/
async function log( message ) {
  try {
    const data = `${ new Date().toISOString() } : ${ message }\n`;
    await fs.appendFile( "./ptil.log", data );
  }
  catch ( err ) {
    console.error( "Could not write to logfile." );
    console.error( err.message );
  }
}


/*******************************************************************************
*  parseReport:                                                                *
*******************************************************************************/
function parseReport( content ) {
  const document = new jsdom.JSDOM( content ).window.document;

  const header = document
  .querySelector( ".header-articler" )
  .textContent
  .trim()
  .replace("–", "-")
  .replace( "–", "-" )
  .split( "-" );
    
  const company = header[0];
  const topic   = header[2] ? header[2] : header[1];
  const unit    = header[2] ? header[1] : "";
    
  const date = document
  .querySelector( ".mb-3" )
  .textContent
  .split( ":" )[1];

  const entries = [];

  makeObjects(
    "Avvik",
    document.querySelectorAll( '[id^="deviation"].tab-pane' )
  );
  
  makeObjects(
    "Forbedringspunkt",
    document.querySelectorAll( '[id^="improvementPoint"].tab-pane' )
  );

  function makeObjects( type, arr ) {
    arr.forEach( ( e, i ) => {
      const heading = ( i === 0 ) 
        ? document
          .querySelector( "div.d-flex:nth-child(2) > h3:nth-child(1)" )
          .textContent
          .replace( / \(PDF\)$/, "" )
        : "";

      let curr = e.firstElementChild;
      const title = curr.textContent;
      
      let description   = "";
      let justification = "";
      let legalBasis    = "";
      
      curr = curr.nextElementSibling;
      curr = curr.nextElementSibling;

      while( curr && curr.textContent !== "Begrunnelse" ) {
        description += curr.textContent;
        curr = curr.nextElementSibling;
      }

      curr = curr.nextElementSibling;

      while( curr && curr.textContent !== "Hjemmel" ) {
        justification += curr.textContent;
        curr = curr.nextElementSibling;
      }
      
      if ( curr ) {
        curr = curr.nextElementSibling;

        [ ...curr.children ].forEach( e =>
          legalBasis += `${ e.querySelector( "p" ).textContent }\n`
        );
      }

      entries.push([
        `${ heading.trim()       }`,
        `${ date.trim()          }`,
        `${ company.trim()       }`,
        `${ unit.trim()          }`,
        "",
        `${ topic.trim()         }`,
        `${ type.trim()          }`,
        `${ title.trim()         }`,
        `${ description.trim()   }`,
        `${ justification.trim() }`,
        `${ legalBasis.trim()    }`,
      ]);
    });
  }

  return entries;
}
