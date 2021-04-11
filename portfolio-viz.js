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
  for (let i = 0; i < parsedCsv.data.length; i++) {
    // Account for header and empty rows.
    if (parsedCsv.data[i].length < 2 || parsedCsv.data[i][1].length == 0 || isNaN(parsedCsv.data[i][1])) {
      continue;
    }
    // Get stock price here.
    let response = await fetch('https://us-central1-stock-price-api.cloudfunctions.net/stock-price-api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
      },
      body: JSON.stringify({ticker: parsedCsv.data[i][0]})
    });
    let responseJson = await response.json();

    // Update data array.
    assets.push(new Asset(parsedCsv.data[i][0], parsedCsv.data[i][1], responseJson.price, responseJson.percent_change));
  }
  console.log(assets);
}

fileInput.onchange = function(e) {
    let file = this.files[0];  // fileInput.files[0] is first file if multiple were selected
    fReader.readAsText(file);
}

