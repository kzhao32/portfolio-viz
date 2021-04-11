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

fReader.onload = function(e) {
  // Parse uploaded file.
  let parsedCsv = Papa.parse(e.target.result);
  // Check if header row is not present.
  let startIndex = 0
  if (typeof(parsedCsv.data[0][1]) === "number") {
    startIndex = 1;
  }

  for (let i = startIndex; i < parsedCsv.data.length; i++) {

    // Get stock price here.

    // Update data array.
    assets.push(new Asset(
      parsedCsv.data[i][0], parsedCsv.data[i][1], 100, 1));
  }
  console.log(assets);
}

fileInput.onchange = function(e) {
    let file = this.files[0];  // fileInput.files[0] is first file if multiple were selected
    fReader.readAsText(file);
}

