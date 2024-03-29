// Global
let hasFileBeenUploaded = false;
let lock = false;
let tickersDict;
let stocksToPriceCheck;
let stockData;
let marketEpochTime;
let rects = [];
let canvas = document.getElementById("myCanvas");
let ctx = canvas.getContext("2d");
let fileInput = document.getElementById("myfile");
// Previously hovered over rect
let lastRect;
// This is for asset box coloring.
const fillStyles = ["#67000d", "#a50026", "#d73027", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850", "#006837", "#00441b"];
const fontFamily = "courier-std";

updateInputDisplay();  // In case a non-default option was cached by the browser.


fileInput.onchange = function(e) {
  let fileInputFile = this.files[0];  // fileInput.files[0] is first file if multiple were selected
  document.title = fileInputFile.name + " Portfolio Map";
  if (typeof (FileReader) == "undefined") {
    alert("This browser does not support HTML5.");
  }
  let fileReader = new FileReader();
  if (fileInputFile.name.toUpperCase().indexOf(".XLS") > 0) {
    fileReader.onload = async function (e) {
      // Borrowed from https://jsfiddle.net/5kftjcg1/
      // Read the Excel File data.
      let workbook = XLSX.read(e.target.result, { type: 'binary' });
      // Fetch the name of First Sheet.
      let firstSheet = workbook.SheetNames[0];
      // Read all rows from First Sheet into csv.
      let csvData = XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheet]);
      processInputChangeFromCsv(csvData);
    };
    fileReader.readAsBinaryString(fileInputFile);
  } else { // Csv file
    fileReader.onload = async function (e) {
      processInputChangeFromCsv(e.target.result);
    };
    fileReader.readAsText(fileInputFile);
  }
}

async function processInputChangeFromCsv(csv) {
  // Parse uploaded file.
  const parsedCsv = Papa.parse(csv);

  tickersDict = {} // create a dictionary because not all stocks will return data. E.g. ALDR

  for (let i = 0; i < parsedCsv.data.length; i++) {
    // Account for header and empty rows.
    if (parsedCsv.data[i].length < 2 || parsedCsv.data[i][1].length == 0 || isNaN(parsedCsv.data[i][1].replace(",", ""))) {
      continue;
    }
    let ticker = parsedCsv.data[i][0].trim().toUpperCase().replace(".", "-");
    tickersDict[ticker] = parseFloat(parsedCsv.data[i][1].replace(",", ""));
  }

  stocksToPriceCheck = [];
  for (ticker in tickersDict) {
    stocksToPriceCheck.push(ticker);
  }

  await updateStockData();

  drawPortfolioViz();

  // Do stuff here only after the first upload.
  if (!hasFileBeenUploaded) {
    // Refresh data at set interval.
    setInterval(async function() {
      refreshDataAndRedraw();
    }, 60 * 1000);

    document.getElementById("tutorial").style.display = "none";
    hasFileBeenUploaded = true;
  }
}

async function refreshDataAndRedraw() {
  if (!hasFileBeenUploaded) {
    return;
  }
  await updateStockData();
  drawPortfolioViz();
}

function drawPortfolioViz() {
  // Assume that responses come back in the same order that stocksToPriceCheck requested.
  // Then need to filter out header and empty rows again to get the index to match with the responses.
  let percentChanges = [];
  let marketValueHeap = new BinaryHeap(function(asset) { return -asset.price * asset.shares; });
  let totalMarketValue = 0;
  let totalChange = 0;

  for (let i = 0; stockData && i < stockData.length; i++) {
    let ticker = stockData[i].ticker;
    let shares = tickersDict[ticker];
    let price = stockData[i].price;
    let percentChange = stockData[i].percent_change;
    let asset = new Asset(ticker, stockData[i].name, shares, price, percentChange);
    // Update data array.
    percentChanges.push(percentChange);
    marketValueHeap.push(asset);
    totalMarketValue += price * shares;
    totalChange += (price - price / (1 + (percentChange ? percentChange : 0) / 100)) * shares;
  }
  let percentChangeStandardDeviation = getStandardDeviation(percentChanges);

  // Determine whether the screen is portrait or landscape.
  let width = (window.innerWidth > 0) ? window.innerWidth : screen.width;
  let height = (window.innerHeight > 0) ? window.innerHeight : screen.height;

  // Draw the portfolio map.
  canvas.style.display = "block";
  // Adjust the canvas size.
  ctx.canvas.width = width * 0.97;
  ctx.canvas.height = height * 0.90;

  let remainingCanvasWidth = ctx.canvas.width;
  let remainingCanvasHeight = ctx.canvas.height;
  let remainingMarketValue = totalMarketValue;

  rects = [];
  lastRect = undefined;
  drawPortfolioVizRecursive(
    ctx,
    marketValueHeap,
    remainingCanvasWidth,
    remainingCanvasHeight,
    remainingMarketValue,
    totalMarketValue,
    0,
    0,
    percentChangeStandardDeviation,
  );

  // yesterday's closing totalMarketValue = totalMarketValue - totalChange
  // totalPercentChange = totalChange / (yesterday's closing totalMarketValue)
  document.getElementById("totalMarketValueStr").textContent = "TotalMarketValue: ";
  document.getElementById("totalMarketValue").textContent = "$" + Math.round(totalMarketValue).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  document.getElementById("changeStr").textContent = "Change: ";
  document.getElementById("change").textContent = (totalChange > 0 ? "+" : "") + ("$" + Math.round(totalChange).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")).replace("$-", "-$") + " (" + (totalChange > 0 ? "+" : "") + (totalChange / (totalMarketValue - totalChange) * 100).toFixed(2) + "%)";
  document.getElementById("change").style.color = totalChange > 0 ? "green" : (totalChange < 0 ? "red" : "black");
}

function drawPortfolioVizRecursive(
  ctx,
  rightMarketValueHeap,
  entireCanvasWidth,
  entireCanvasHeight,
  entireMarketValue,
  totalMarketValue,
  startX,
  startY,
  percentChangeStandardDeviation,
) {
  // Get the next top asset
  // Draw a rectangle hamburger-style into the remaining canvas space
  // Calculate how large the rectangle should be based off the totalMarketValue: asset.price * asset.shares / totalMarketValue
  // The rectangle should be colored based on the percent change
  // Fill in some text like the ticker name and percent change (centered if possible)
  // Keep track of what the remaining space is
  while (rightMarketValueHeap.size() > 0) {
    let leftAsset = rightMarketValueHeap.pop();
    if (rightMarketValueHeap.size() == 0) {
      let portion = leftAsset.price * leftAsset.shares / entireMarketValue;

      // if landscape, we want to make a vertical cut
      // set endX to be some calculation
      // set endY to be the entire remainder of the canvas
      let width = entireCanvasWidth * portion;
      let height = entireCanvasHeight;
      // If portrait...
      if (entireCanvasWidth < entireCanvasHeight) {
        // Make horizontal cut.
        width = entireCanvasWidth;
        height = entireCanvasHeight * portion;
      }

      let [penStyle, fillStyle] = getStyles(leftAsset.percentChange, percentChangeStandardDeviation);
      let percentChangeStr;
      if (leftAsset.percentChange === null) {
        leftAsset.percentChange = 0;
        percentChangeStr = "N/A";
      }
      else {
        percentChangeStr = `${(leftAsset.percentChange).toFixed(2)}%`;
        if (percentChangeStr[0] != '-') {
          percentChangeStr = '+' + percentChangeStr;
        }
      }
      let rectPortion = leftAsset.price * leftAsset.shares / totalMarketValue * 100;
      let rectPortionDivisor = 0.01;
      let rectPortionPlaces = 2;
      // Maximum decimal places is 6 due to the stock API.
      while (rectPortion < rectPortionDivisor && rectPortionPlaces < 6) {
        rectPortionDivisor /= 10;
        rectPortionPlaces++;
      }

      rect = {
        'startX': startX,
        'startY': startY,
        'width': width,
        'height': height,
        'ticker': leftAsset.ticker,
        'name': leftAsset.name,
        'price': leftAsset.price,
        'percentChange': leftAsset.percentChange,
        'percentChangeStr': percentChangeStr,
        'portion': `${rectPortion.toFixed(rectPortionPlaces)}%`,
        'penStyle': penStyle,
        'fillStyle': fillStyle,
      }

      rects.push(rect);

      drawOneRect(rect);

      entireMarketValue -= leftAsset.price * leftAsset.shares;
      // If remaining area is portrait...
      if (entireCanvasWidth < entireCanvasHeight) {
        entireCanvasHeight -= height;
        startY += height;
      }
      else {
        entireCanvasWidth -= width;
        startX += width;
      }
    }
    else {
      // Split heap into two. Always put the most valuable asset into the left heap.
      // Continue putting assets into the left heap while the left heap is worth less than half of the entireMarketValue
      let leftMarketValueHeap = new BinaryHeap(function(asset) { return -asset.price * asset.shares; });
      let leftMarketValue = leftAsset.price * leftAsset.shares;
      let rightMarketValue = entireMarketValue - leftAsset.price * leftAsset.shares;
      leftMarketValueHeap.push(leftAsset);
      while (leftMarketValue < 0.5 * rightMarketValue && rightMarketValueHeap.size() > 0) {
        let nextAsset = rightMarketValueHeap.pop();
        if (leftMarketValue + nextAsset.price * nextAsset.shares < rightMarketValue) {
          rightMarketValue -= nextAsset.price * nextAsset.shares;
          leftMarketValue += nextAsset.price * nextAsset.shares;
          leftMarketValueHeap.push(nextAsset);
        }
        else {
          rightMarketValueHeap.push(nextAsset);
          break; // done splitting into 2 heaps
        }
      }

      let isPortrait = entireCanvasWidth < entireCanvasHeight;
      // draw left/top side of the portfolio
      drawPortfolioVizRecursive(
        ctx,
        leftMarketValueHeap,
        /* entireCanvasWidth = */ isPortrait ? entireCanvasWidth : entireCanvasWidth * leftMarketValue / entireMarketValue, // if isPortrait, then make a horizontal cut, so (left and right) xor (top and bottom) get the entire width
        /* entireCanvasHeight = */ isPortrait ? entireCanvasHeight * leftMarketValue / entireMarketValue : entireCanvasHeight,
        /* entireMarketValue = */ leftMarketValue,
        totalMarketValue,
        /* startX = */ startX,
        /* startY = */ startY,
        percentChangeStandardDeviation,
      );
      // draw right/bottom side of the portfolio
      drawPortfolioVizRecursive(
        ctx,
        rightMarketValueHeap,
        /* entireCanvasWidth = */ isPortrait ? entireCanvasWidth : entireCanvasWidth * rightMarketValue / entireMarketValue,
        /* entireCanvasHeight = */ isPortrait ? entireCanvasHeight * rightMarketValue / entireMarketValue : entireCanvasHeight,
        /* entireMarketValue = */ rightMarketValue,
        totalMarketValue,
        /* startX = */ isPortrait ? startX : startX + leftMarketValue / entireMarketValue * entireCanvasWidth, // if isPortrait, then make a horizontal cut, so startX stays the same, and adjust startY proportionally to market value
        /* startY = */ isPortrait ? startY + leftMarketValue / entireMarketValue * entireCanvasHeight : startY,
        percentChangeStandardDeviation,
      );
    }
  }
}

function resizedWindow(){
  // Haven't resized in 1000ms!
  // After done resizing...
  if (hasFileBeenUploaded) {
    drawPortfolioViz();
  }
}

let timerId;
window.onresize = function() {
  clearTimeout(timerId);
  timerId = setTimeout(resizedWindow, 1000);
};

async function updateStockData() {
  // Get stock prices here.
  let requestBody = {};
  requestBody['tickers'] = stocksToPriceCheck;
  let time_since = document.getElementById("time_since").value;
  if (time_since != "1d") {
    requestBody['time_since'] = time_since;
  }
  let response = await fetch('https://us-central1-stock-price-api-403721.cloudfunctions.net/python-http-function', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: JSON.stringify(requestBody)
  });

  let responseJson = await response.json();
  stockData = responseJson['stock_data'];
  marketEpochTime = responseJson['market_time'];
}

class Asset {
  constructor(ticker, name, shares, price, percentChange) {
    this.ticker = ticker;
    this.name = name;
    this.shares = shares;
    this.price = price;
    this.percentChange = percentChange;
  }
}

// Borrowed from https://stackoverflow.com/questions/7343890/standard-deviation-javascript
function getStandardDeviation (array) {
  const n = array.length
  const mean = array.reduce((a, b) => a + b) / n
  return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
}

// Taken from Eloquent JavaScript.
function BinaryHeap(scoreFunction){
  this.content = [];
  this.scoreFunction = scoreFunction;
}

BinaryHeap.prototype = {
  push: function(element) {
    // Add the new element to the end of the array.
    this.content.push(element);
    // Allow it to bubble up.
    this.bubbleUp(this.content.length - 1);
  },

  pop: function() {
    // Store the first element so we can return it later.
    var result = this.content[0];
    // Get the element at the end of the array.
    var end = this.content.pop();
    // If there are any elements left, put the end element at the
    // start, and let it sink down.
    if (this.content.length > 0) {
      this.content[0] = end;
      this.sinkDown(0);
    }
    return result;
  },

  remove: function(node) {
    var length = this.content.length;
    // To remove a value, we must search through the array to find
    // it.
    for (var i = 0; i < length; i++) {
      if (this.content[i] != node) continue;
      // When it is found, the process seen in 'pop' is repeated
      // to fill up the hole.
      var end = this.content.pop();
      // If the element we popped was the one we needed to remove,
      // we're done.
      if (i == length - 1) break;
      // Otherwise, we replace the removed element with the popped
      // one, and allow it to float up or sink down as appropriate.
      this.content[i] = end;
      this.bubbleUp(i);
      this.sinkDown(i);
      break;
    }
  },

  size: function() {
    return this.content.length;
  },

  bubbleUp: function(n) {
    // Fetch the element that has to be moved.
    var element = this.content[n], score = this.scoreFunction(element);
    // When at 0, an element can not go up any further.
    while (n > 0) {
      // Compute the parent element's index, and fetch it.
      var parentN = Math.floor((n + 1) / 2) - 1,
      parent = this.content[parentN];
      // If the parent has a lesser score, things are in order and we
      // are done.
      if (score >= this.scoreFunction(parent))
        break;

      // Otherwise, swap the parent with the current element and
      // continue.
      this.content[parentN] = element;
      this.content[n] = parent;
      n = parentN;
    }
  },

  sinkDown: function(n) {
    // Look up the target element and its score.
    var length = this.content.length,
    element = this.content[n],
    elemScore = this.scoreFunction(element);

    while(true) {
      // Compute the indices of the child elements.
      var child2N = (n + 1) * 2, child1N = child2N - 1;
      // This is used to store the new position of the element,
      // if any.
      var swap = null;
      // If the first child exists (is inside the array)...
      if (child1N < length) {
        // Look it up and compute its score.
        var child1 = this.content[child1N],
        child1Score = this.scoreFunction(child1);
        // If the score is less than our element's, we need to swap.
        if (child1Score < elemScore)
          swap = child1N;
      }
      // Do the same checks for the other child.
      if (child2N < length) {
        var child2 = this.content[child2N],
        child2Score = this.scoreFunction(child2);
        if (child2Score < (swap == null ? elemScore : child1Score))
          swap = child2N;
      }

      // No need to swap further, we are done.
      if (swap == null) break;

      // Otherwise, swap and continue.
      this.content[n] = this.content[swap];
      this.content[swap] = element;
      n = swap;
    }
  }
};

function getStyles(percentChange, percentChangeStandardDeviation) {
  if (percentChange === null) {
      return ["#FFFFFF", "#000000"]
  }
  // Handle extreme ends.
  if (percentChange < -3.0 * percentChangeStandardDeviation) {
      return ["#FFFFFF", fillStyles[0]]
  }
  if (percentChange > 3.0 * percentChangeStandardDeviation) {
      return ["#FFFFFF", fillStyles[fillStyles.length - 1]]
  }
  // Compute the left and right color and value.
  // Return the color based on linear regression of the 2 colors.
  let leftColor = fillStyles[6];
  let leftValue = 0.0;
  let rightColor = fillStyles[7];
  let rightValue = 0.5;
  let penStyle = "#000000";
  if (percentChange < -2.5 * percentChangeStandardDeviation) {
      leftColor = fillStyles[0];
      leftValue = -3.0;
      rightColor = fillStyles[1];
      rightValue = -2.5;
      penStyle = "#FFFFFF";
  }
  else if (percentChange < -2.0 * percentChangeStandardDeviation) {
      leftColor = fillStyles[1];
      leftValue = -2.5;
      rightColor = fillStyles[2];
      rightValue = -2.0;
      penStyle = "#FFFFFF";
  }
  else if (percentChange < -1.5 * percentChangeStandardDeviation) {
      leftColor = fillStyles[2];
      leftValue = -2.0;
      rightColor = fillStyles[3];
      rightValue = -1.5;
  }
  else if (percentChange < -1.0 * percentChangeStandardDeviation) {
      leftColor = fillStyles[3];
      leftValue = -1.5;
      rightColor = fillStyles[4];
      rightValue = -1.0;
  }
  else if (percentChange < -0.5 * percentChangeStandardDeviation) {
      leftColor = fillStyles[4];
      leftValue = -1.0;
      rightColor = fillStyles[5];
      rightValue = -0.5;
  }
  else if (percentChange < 0.0 * percentChangeStandardDeviation) {
      leftColor = fillStyles[5];
      leftValue = -0.5;
      rightColor = fillStyles[6];
      rightValue = 0.0;
  }
  else if (percentChange > 2.5 * percentChangeStandardDeviation) {
      leftColor = fillStyles[11];
      leftValue = 2.5;
      rightColor = fillStyles[12];
      rightValue = 3.0;
      penStyle = "#FFFFFF";
  }
  else if (percentChange > 2.0 * percentChangeStandardDeviation) {
      leftColor = fillStyles[10];
      leftValue = 2.0;
      rightColor = fillStyles[11];
      rightValue = 2.5;
      penStyle = "#FFFFFF";
  }
  else if (percentChange > 1.5 * percentChangeStandardDeviation) {
      leftColor = fillStyles[9];
      leftValue = 1.5;
      rightColor = fillStyles[10];
      rightValue = 2.0;
  }
  else if (percentChange > 1.0 * percentChangeStandardDeviation) {
      leftColor = fillStyles[8];
      leftValue = 1.0;
      rightColor = fillStyles[9];
      rightValue = 1.5;
  }
  else if (percentChange > 0.5 * percentChangeStandardDeviation) {
      leftColor = fillStyles[7];
      leftValue = 0.5;
      rightColor = fillStyles[8];
      rightValue = 1.0;
  }
  leftValue *= percentChangeStandardDeviation;
  rightValue *= percentChangeStandardDeviation;
  let leftRed = parseInt(leftColor.substring(1, 3), 16);
  let leftGreen = parseInt(leftColor.substring(3, 5), 16);
  let leftBlue = parseInt(leftColor.substring(5, 7), 16);
  let rightRed = parseInt(rightColor.substring(1, 3), 16);
  let rightGreen = parseInt(rightColor.substring(3, 5), 16);
  let rightBlue = parseInt(rightColor.substring(5, 7), 16);
  // y = m*x+b = (rise/run)*x + b
  let red = Math.round((rightRed - leftRed)/(rightValue - leftValue)*(percentChange - leftValue) + leftRed);
  let green = Math.round((rightGreen - leftGreen)/(rightValue - leftValue)*(percentChange - leftValue) + leftGreen);
  let blue = Math.round((rightBlue - leftBlue)/(rightValue - leftValue)*(percentChange - leftValue) + leftBlue);

  return [penStyle, "#" + ("0"+(Number(red).toString(16))).slice(-2) + ("0"+(Number(green).toString(16))).slice(-2) + ("0"+(Number(blue).toString(16))).slice(-2)];
}

function drawBorder(ctx, xPos, yPos, width, height, color, thickness=1)
{
  ctx.fillStyle = color;
  ctx.fillRect(xPos - (thickness), yPos - (thickness), width + (thickness * 2), height + (thickness * 2));
}

function drawOneRect(rect, borderColor='#000000') {
  drawBorder(ctx, rect.startX, rect.startY, rect.width, rect.height, borderColor);
  ctx.fillStyle = rect.fillStyle;
  ctx.fillRect(rect.startX, rect.startY, rect.width, rect.height);
  ctx.fillStyle = rect.penStyle;
  let fontSize = Math.min(rect.width, rect.height) / 4;
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillText(rect.ticker, rect.startX + rect.width / 2 - rect.ticker.length * fontSize/3, rect.startY + rect.height / 2.2);
  ctx.fillText(rect.percentChangeStr, rect.startX + rect.width / 2 - rect.percentChangeStr.length * fontSize/30*9, rect.startY + rect.height / 2.2 + fontSize);
}

canvas.onmousemove = function(e) {
  // important: correct mouse position:
  var domRect = this.getBoundingClientRect(),
      x = e.clientX - domRect.left,
      y = e.clientY - domRect.top,
      i = 0, r;

  let hoveredRect;
  while(r = rects[i++]) {
    // add a single rect to path:
    ctx.beginPath();
    ctx.rect(r.startX, r.startY, r.width, r.height);

    // check if we hover it, fill red, if not fill it blue
    if (ctx.isPointInPath(x, y)) {
      hoveredRect = r;
    }
    else {
      // drawOneRect(r);
    }
  }
  try {
    // Only draw rects if on a newly hovered rect.
    if (lastRect !== hoveredRect) {
      if (typeof lastRect !== "undefined") {
        drawOneRect(lastRect);
      }
      lastRect = hoveredRect;
      drawOneRect(hoveredRect, "#FFFFFF");

      // Update tooltip based on currently hovered rect.
      let amountChangeStr = (hoveredRect.price - hoveredRect.price / (1 + hoveredRect.percentChange / 100)).toFixed(2);
      if (amountChangeStr[0] != '-') {
        amountChangeStr = '+' + amountChangeStr;
      }
      canvas.title = hoveredRect.ticker + (hoveredRect.name.length > 0 ? ("\nName: " + hoveredRect.name) : "") + "\nPrice: " + hoveredRect.price + "\nChange: " + amountChangeStr + " (" + hoveredRect.percentChangeStr + ")" + "\nPortion: " + hoveredRect.portion;
    }
  }
  catch (e) {
    if (e instanceof TypeError) {
      // ignore :(
    }
    else {
      throw e;
    }
  }
};

canvas.ondblclick = function(e) {
  if (typeof lastRect !== "undefined") {
    window.open(`https://finance.yahoo.com/quote/${lastRect.ticker}`);
  }
}

function getReadableTime() {
  let date = new Date(marketEpochTime * 1000);
  return `${date.getHours()}:${('0' + date.getMinutes()).substr(-2)}:${('0' + date.getSeconds()).substr(-2)} ET`;
}

function updateInputDisplay() {
  const inputType = document.getElementById('input-type').value;
  const myfileInput = document.getElementById('myfile');
  const mytextInput = document.getElementById('mytext');
  if (inputType === 'file') {
    mytextInput.style.display = "none";
    myfileInput.style.display = "inline";
  }
  else if (inputType === 'text') {
    mytextInput.style.display = "inline";
    myfileInput.style.display = "none";
  }
}

function onMytextSubmit() {
  processInputChangeFromCsv(document.getElementById('mytext-input').value);
}