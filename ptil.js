"use strict"

/*******************************************************************************
*  imports                                                                     *
*******************************************************************************/
import axios     from "axios";
import exceljs   from "exceljs";
import { JSDOM } from "jsdom";


/*******************************************************************************
*  ptil.js:                                                                    *
*******************************************************************************/
console.log( "fetching latest" );
const baseUrl  = "https://www.ptil.no"
const request  = await axios.get( `${ baseUrl }/tilsyn/tilsynsrapporter/` );
const document = new JSDOM( request.data ).window.document;
const result   = document.querySelectorAll( "#list-page-result a.pcard" );

console.log( `found ${ result.length } reports` );
const reports = await Promise.all( [ ...result ].map( result => 
  axios.get( `https://www.ptil.no${ result.href }` )
));

const entries = reports.map( (report, index) => {
  console.log( `parsing report ${ index + 1 }` );
  parseReport( report.data );
});

// console.log( "writing to excel" );
// await writeToExcel( entries.flat() );


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
    arr.forEach( e => {
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
        ``,
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

  if ( entries[0] ) {
    entries[0][0] = document
    .querySelector( "div.d-flex:nth-child(2) > h3:nth-child(1)" )
    .textContent
    .replace( / \(PDF\)$/, "" );
    console.log( entries[0][0] );
  }
  
  console.log( "entries: " + entries.length + "\n" );

  return entries;
}


/*******************************************************************************
*  writeToExcel:                                                               *
*******************************************************************************/
async function writeToExcel( entries ) {
  const workbook = new exceljs.Workbook();
  await workbook.xlsx.readFile( "ptil.xlsx" );

  const worksheet = workbook.worksheets[0];
  worksheet.addRows( entries );

  await workbook.xlsx.writeFile( "test.xlsx" );
}
