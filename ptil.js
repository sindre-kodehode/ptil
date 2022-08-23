"use strict"
/*******************************************************************************
*  imports                                                                     *
*******************************************************************************/
import { appendFile } from "fs/promises";
import axios          from "axios";
import config         from "./ptil.json" assert { type: "json" };
import exceljs        from "exceljs";
import { JSDOM }      from "jsdom";


/*******************************************************************************
*  variables                                                                   *
*******************************************************************************/
let tilsynReq;
let tilsynDoc;
let tilsynRes;
let tilsynReports;
let tilsynEntries;


/*******************************************************************************
*  tilsyn:                                                                     *
*******************************************************************************/

// fetch latest from tilsyn site
try {
  logToFile( "INFO", "fetching latest tilsyn"  );
  tilsynReq = await axios.get( config.tilsynLatest );
  tilsynDoc = new JSDOM( tilsynReq.data ).window.document;
  tilsynRes = tilsynDoc.querySelectorAll( "#list-page-result a.pcard" );
}
catch ( err ) {
  logToFile( "ERROR", "error while fetching latest tilsyn."  );
  logToFile( "ERROR", err.message );
}

// fetch individual reports
try {
  logToFile( "INFO", `found ${ tilsynRes.length } tilsyn reports` );
  tilsynReports = await Promise.all( [ ...tilsynRes ].map( result =>
    axios.get( `${ config.baseUrl }${ result.href }` )
  ));
}
catch ( err ) {
  logToFile( "ERROR", "error while fetching tilsyn reports." );
  logToFile( "ERROR", err.message );
}

// parse fetched reports
try {
  logToFile( "INFO", "parsing reports" );
  tilsynEntries = tilsynReports.reverse().map( report =>
    parseReport( report.data )
  );
}
catch ( err ) {
  logToFile( "ERROR", "error while parsing tilsyn reports." );
  logToFile( "ERROR", err.message );
}

// write to excel
try {
  logToFile( "INFO", "writing to excel" );
  const workbook = new exceljs.Workbook();
  await workbook.xlsx.readFile( config.tilsynDb );

  const worksheet = workbook.worksheets[0];
  worksheet.addRows( tilsynEntries.flat(), "i" );

  await workbook.xlsx.writeFile( config.tilsynDb );
}
catch ( err ) {
  logToFile( "ERROR", "error while writing to Excel." );
  logToFile( "ERROR", err.message );
}


/*******************************************************************************
*  logToFile:                                                                  *
*******************************************************************************/
async function logToFile( type, message ) {
  try {
    await appendFile( 
      config.logFile,
      `${ new Date().toISOString() } : ` +
      `${ type.padEnd( 5, " " ) } : `    +
      `${ message }\n`
    );

  } catch ( err ) {
    console.error( "Could not write to logfile." );
    console.error( err.message );
  }
}


/*******************************************************************************
*  parseReport:                                                                *
*******************************************************************************/
function parseReport( content ) {
  const document = new JSDOM( content ).window.document;

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
