// Global
let assets = []
let fileOnloadEvent;
let hasFileBeenUploaded = false;
// This is for asset box coloring.
const fillStyles = ["#67000d", "#a50026", "#d73027", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850", "#006837", "#00441b"];

let fileInput = document.getElementById("myfile");
let fReader = new FileReader();


fReader.onload = function(e) {
  // Allow global access to event.
  fileOnloadEvent = e;
  hasFileBeenUploaded = true;

  drawPortfolioViz(e);
}

async function drawPortfolioViz(e) {
  // Parse uploaded file.
  let parsedCsv = Papa.parse(e.target.result);
  stocks_price_check = []
  for (let i = 0; i < parsedCsv.data.length; i++) {
    // Account for header and empty rows.
    if (parsedCsv.data[i].length < 2 || parsedCsv.data[i][1].length == 0 || isNaN(parsedCsv.data[i][1])) {
      continue;
    }
    stocks_price_check.push(parsedCsv.data[i][0].trim().toUpperCase())
  }
//console.log(stocks_price_check)
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
  let totalMarketValue = 0;
  let totalChange = 0;
  let marketValueHeap = new BinaryHeap(function(asset) { return -asset.price * asset.shares; });
//console.log("stocks_price_check.length = " + stocks_price_check.length + ", responseJson.length = " + responseJson.length);
  for (let i = 0, response_index = 0; i < parsedCsv.data.length; i++) {
    // Account for header and empty rows.
    if (parsedCsv.data[i].length < 2 || parsedCsv.data[i][1].length == 0 || isNaN(parsedCsv.data[i][1])) {
      continue;
    }
    let shares = parsedCsv.data[i][1];
    let price = responseJson[response_index].price;
    let percentChange = responseJson[response_index].percent_change;
    let asset = new Asset(responseJson[response_index].ticker, shares, price, percentChange);
//console.log("asset from responseJson: responseJson[response_index].ticker = " + responseJson[response_index].ticker + ", percentChange = " + percentChange);
    // Update data array.
    assets.push(asset);
    marketValueHeap.push(asset);
    totalMarketValue += price * shares;
    totalChange += price * shares * percentChange;
    response_index++;
  }
//console.log(assets);

  // Determine whether the screen is portrait or landscape.
  let width = (window.innerWidth > 0) ? window.innerWidth : screen.width;
  let height = (window.innerHeight > 0) ? window.innerHeight : screen.height;

  // Draw the portfolio map.
  let canvas = document.getElementById("myCanvas");
  canvas.style.display = "block";
  let ctx = canvas.getContext("2d");
  // Adjust the canvas size.
  ctx.canvas.width = width * 0.97;
  ctx.canvas.height = height * 0.95;

  let remainingCanvasWidth = ctx.canvas.width;
  let remainingCanvasHeight = ctx.canvas.height;
  let remainingMarketValue = totalMarketValue;

  drawPortfolioVizRecursive(
    ctx,
    marketValueHeap,
    remainingCanvasWidth,
    remainingCanvasHeight,
    remainingMarketValue,
    0,
    0,
  );
  let info = document.getElementById("info");
  info.textContent = "TotalMarketValue = $" + Math.round(totalMarketValue).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "; Change = " + (totalChange > 0 ? "+" : "") + Math.round(totalChange).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " (" + (totalChange / totalMarketValue * 100).toFixed(2) + "%)";
  info.style.color = totalChange > 0 ? "green" : (totalChange < 0 ? "red" : "black");
}

function drawPortfolioVizRecursive(
  ctx,
  rightMarketValueHeap,
  entireCanvasWidth,
  entireCanvasHeight,
  entireMarketValue,
  startX,
  startY,
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
      let [penStyle, fillStyle] = getStyles(leftAsset.percentChange * 100);
      drawBorder(ctx, startX, startY, width, height);
      ctx.fillStyle = fillStyle;
      ctx.fillRect(startX, startY, width, height);
      ctx.fillStyle = penStyle;
      ctx.font = "30px serif";
      ctx.fillText(leftAsset.ticker, startX + width / 2 - leftAsset.ticker.length * 10, startY + height / 2);
      let percentChangeStr = `${(leftAsset.percentChange * 100).toFixed(2)}%`;
      if (percentChangeStr[0] != '-') {
        percentChangeStr = '+' + percentChangeStr;
      }
      ctx.fillText(percentChangeStr, startX + width / 2 - percentChangeStr.length * 9, startY + height / 2 + 30);
console.log("for " + leftAsset.ticker + " " + percentChangeStr + ", fillRect(" + startX + ", " + startY + ", " + width + ", " + height + ")");

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
      while (leftMarketValue < 0.5 * rightMarketValue) {
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
        /* startX = */ startX,
        /* startY = */ startY,
      );
      // draw right/bottom side of the portfolio
      drawPortfolioVizRecursive(
        ctx,
        rightMarketValueHeap,
        /* entireCanvasWidth = */ isPortrait ? entireCanvasWidth : entireCanvasWidth * rightMarketValue / entireMarketValue,
        /* entireCanvasHeight = */ isPortrait ? entireCanvasHeight * rightMarketValue / entireMarketValue : entireCanvasHeight,
        /* entireMarketValue = */ rightMarketValue,
        /* startX = */ isPortrait ? startX : startX + leftMarketValue / entireMarketValue * entireCanvasWidth, // if isPortrait, then make a horizontal cut, so startX stays the same, and adjust startY proportionally to market value
        /* startY = */ isPortrait ? startY + leftMarketValue / entireMarketValue * entireCanvasHeight : startY,
      );
    }
  }
}

fileInput.onchange = function(e) {
    let file = this.files[0];  // fileInput.files[0] is first file if multiple were selected
    fReader.readAsText(file);
    document.title = file.name + " Portfolio Map";
    // this.style.display = "none";
}

function resizedWindow(){
  // Haven't resized in 1000ms!
  // After done resizing...
  if (hasFileBeenUploaded) {
    drawPortfolioViz(fileOnloadEvent);
  }
}

let timerId;
window.onresize = function() {
  clearTimeout(timerId);
  timerId = setTimeout(resizedWindow, 1000);
};

setInterval(function() {
  if (hasFileBeenUploaded) {
    drawPortfolioViz(fileOnloadEvent);
  }
}, 60 * 1000);

class Asset {
  constructor(ticker, shares, price, percentChange) {
    this.ticker = ticker;
    this.shares = shares;
    this.price = price;
    this.percentChange = percentChange;
  }
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

function getStyles(percentChange) {
  // Handle extreme ends.
  if (percentChange < -10) {
      return ["#FFFFFF", fillStyles[0]]
  }
  if (percentChange > 10) {
      return ["#FFFFFF", fillStyles[fillStyles.length - 1]]
  }
  // Compute the left and right color and value.
  // Return the color based on linear regression of the 2 colors.
  let leftColor = fillStyles[6];
  let leftValue = 0.0;
  let rightColor = fillStyles[7];
  let rightValue = 0.5;
  let penStyle = "#000000";
  if (percentChange < -2.5) {
      leftColor = fillStyles[0];
      leftValue = -10.0;
      rightColor = fillStyles[1];
      rightValue = -2.5;
      penStyle = "#FFFFFF";
  }
  else if (percentChange < -2.0) {
      leftColor = fillStyles[1];
      leftValue = -2.5;
      rightColor = fillStyles[2];
      rightValue = -2.0;
      penStyle = "#FFFFFF";
  }
  else if (percentChange < -1.5) {
      leftColor = fillStyles[2];
      leftValue = -2.0;
      rightColor = fillStyles[3];
      rightValue = -1.5;
  }
  else if (percentChange < -1.0) {
      leftColor = fillStyles[3];
      leftValue = -1.5;
      rightColor = fillStyles[4];
      rightValue = -1.0;
  }
  else if (percentChange < -0.5) {
      leftColor = fillStyles[4];
      leftValue = -1.0;
      rightColor = fillStyles[5];
      rightValue = -0.5;
  }
  else if (percentChange < 0.0) {
      leftColor = fillStyles[5];
      leftValue = -0.5;
      rightColor = fillStyles[6];
      rightValue = 0.0;
  }
  else if (percentChange > 2.5) {
      leftColor = fillStyles[11];
      leftValue = 2.5;
      rightColor = fillStyles[12];
      rightValue = 10.0;
      penStyle = "#FFFFFF";
  }
  else if (percentChange > 2.0) {
      leftColor = fillStyles[10];
      leftValue = 2.0;
      rightColor = fillStyles[11];
      rightValue = 2.5;
      penStyle = "#FFFFFF";
  }
  else if (percentChange > 1.5) {
      leftColor = fillStyles[9];
      leftValue = 1.5;
      rightColor = fillStyles[10];
      rightValue = 2.0;
  }
  else if (percentChange > 1.0) {
      leftColor = fillStyles[8];
      leftValue = 1.0;
      rightColor = fillStyles[9];
      rightValue = 1.5;
  }
  else if (percentChange > 0.5) {
      leftColor = fillStyles[7];
      leftValue = 0.5;
      rightColor = fillStyles[8];
      rightValue = 1.0;
  }
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
//console.log("for percentChange = " + percentChange + ", leftColor = " + leftColor + ", leftValue = " + leftValue + ", rightColor = " + rightColor + ", rightValue = " + rightValue + ", returning " + "#" + ("0"+(Number(red).toString(16))).slice(-2) + ("0"+(Number(green).toString(16))).slice(-2) + ("0"+(Number(blue).toString(16))).slice(-2));
  return [penStyle, "#" + ("0"+(Number(red).toString(16))).slice(-2) + ("0"+(Number(green).toString(16))).slice(-2) + ("0"+(Number(blue).toString(16))).slice(-2)];
}

function drawBorder(ctx, xPos, yPos, width, height, thickness=1)
{
  ctx.fillStyle='#000';
  ctx.fillRect(xPos - (thickness), yPos - (thickness), width + (thickness * 2), height + (thickness * 2));
}
