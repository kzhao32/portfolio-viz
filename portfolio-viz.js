// Global
let assets = []

let fileInput = document.getElementById("myfile");
let fReader = new FileReader();

class Asset {
  constructor(ticker, shares, price, percentChange) {
    this.ticker = ticker;
    this.shares = shares;
    this.price = price;
    this.percentChange = percentChange;
  }
}

fReader.onload = async function(e) {
  // Parse uploaded file.
  let parsedCsv = Papa.parse(e.target.result);
  stocks_price_check = []
  for (let i = 0; i < parsedCsv.data.length; i++) {
    // Account for header and empty rows.
    if (parsedCsv.data[i].length < 2 || parsedCsv.data[i][1].length == 0 || isNaN(parsedCsv.data[i][1])) {
      continue;
    }
    stocks_price_check.push(parsedCsv.data[i][0])
  }
  // Get stock prices here.
  let response = await fetch('https://us-central1-stock-price-api.cloudfunctions.net/stock-price-api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: JSON.stringify({tickers: stocks_price_check})
  });
  let responseJson = await response.json();

  // Assume that responses come back in the same order that stocks_price_check requested.
  // Then need to filter out header and empty rows again to get the index to match with the responses.
  for (let i = 0, response_index = 0; i < parsedCsv.data.length; i++) {
    // Account for header and empty rows.
    if (parsedCsv.data[i].length < 2 || parsedCsv.data[i][1].length == 0 || isNaN(parsedCsv.data[i][1])) {
      continue;
    }
    // Update data array.
    assets.push(new Asset(responseJson[response_index].ticker, parsedCsv.data[i][1], responseJson[response_index].price, responseJson[response_index].percent_change));
    response_index++;
  }
  console.log(assets);
}

fileInput.onchange = function(e) {
    let file = this.files[0];  // fileInput.files[0] is first file if multiple were selected
    fReader.readAsText(file);
}

