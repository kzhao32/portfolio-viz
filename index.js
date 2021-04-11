// Global
let assets = []
// This is for asset box coloring.
const fillStyles = ["#a50026", "#d73027", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850", "#006837"];


let fileInput = document.getElementById("myfile");
let fReader = new FileReader();

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
  let totalMarketValue = 0;
  let marketValueHeap = new BinaryHeap(function(asset) { return -asset.price * asset.shares; });
  for (let i = 0, response_index = 0; i < parsedCsv.data.length; i++) {
    // Account for header and empty rows.
    if (parsedCsv.data[i].length < 2 || parsedCsv.data[i][1].length == 0 || isNaN(parsedCsv.data[i][1])) {
      continue;
    }
    let shares = parsedCsv.data[i][1];
    let price = responseJson[response_index].price;
    let asset = new Asset(responseJson[response_index].ticker, shares, price, responseJson[response_index].percent_change);
    // Update data array.
    assets.push(asset);
    marketValueHeap.push(asset);
    totalMarketValue += price * shares;
    response_index++;
  }
console.log(assets);
console.log(`totalMarketValue: ${totalMarketValue}`);
// console.log(`marketValueHeap: `);
  // while (marketValueHeap.size() > 0) {
  //   console.log(marketValueHeap.pop());
  // }

  // Determine whether the screen is portrait or landscape.
  let width = (window.innerWidth > 0) ? window.innerWidth : screen.width;
  let height = (window.innerHeight > 0) ? window.innerHeight : screen.height;

  // Draw the portfolio map.
  let canvas = document.getElementById("myCanvas");
  let ctx = canvas.getContext("2d");
  // Adjust the canvas size.
  ctx.canvas.width = width * 0.975;
  ctx.canvas.height = height * 0.975;

  let remainingCanvasWidth = ctx.canvas.width;
  let remainingCanvasHeight = ctx.canvas.height;
  let remainingMarketValue = totalMarketValue;

  // Get the next top asset
  // Draw a rectangle hamburger-style into the remaining canvas space
  // Calculate how large the rectangle should be based off the totalMarketValue: asset.price * asset.shares / totalMarketValue
  // The rectangle should be colored based on the percent change
  // Fill in some text like the ticker name and percent change (centered if possible)
  // Keep track of what the remaining space is
  curColor = 0;
  while (marketValueHeap.size() > 0) {
    let currentAsset = marketValueHeap.pop();
console.log(currentAsset);
    let portion = currentAsset.price * currentAsset.shares / remainingMarketValue;
    let startX = ctx.canvas.width - remainingCanvasWidth;
    let startY = ctx.canvas.height - remainingCanvasHeight;
    // if landscape, we want to make a vertical cut
    // set endX to be some calculation
    // set endY to be the entire remainder of the canvas
    let width = remainingCanvasWidth * portion;
    let height = remainingCanvasHeight;
    // If portrait...
    if (remainingCanvasWidth < remainingCanvasHeight) {
      // Make horizontal cut.
      width = remainingCanvasWidth;
      height = remainingCanvasHeight * portion;
    }
    let [penStyle, fillStyle] = getStyles(currentAsset.percentChange * 100);
    drawBorder(ctx, startX, startY, width, height);
    ctx.fillStyle = fillStyle;
    ctx.fillRect(startX, startY, width, height);
    ctx.fillStyle = penStyle;
    ctx.font = "30px serif";
    ctx.fillText(currentAsset.ticker, startX + width / 2 - currentAsset.ticker.length * 10, startY + height / 2);
    let percentChangeStr = `${(currentAsset.percentChange * 100).toFixed(2)}%`;
    if (percentChangeStr[0] != '-') {
      percentChangeStr = '+' + percentChangeStr;
    }
    ctx.fillText(percentChangeStr, startX + width / 2 - percentChangeStr.length * 10, startY + height / 2 + 30);

    remainingMarketValue -= currentAsset.price * currentAsset.shares;
    if (remainingCanvasWidth < remainingCanvasHeight) {
      remainingCanvasHeight -= height;
    }
    else {
      remainingCanvasWidth -= width;
    }
  }
  // ctx.fillStyle = "#FF0000";
  // ctx.fillRect(67/(442-(220+21)-120)*500,(120)/(442-(220+21))*500,500,60);
  // ctx.fillStyle = "#000000";
  // ctx.fillText("GOOG", 300, 400);
}

fileInput.onchange = function(e) {
    let file = this.files[0];  // fileInput.files[0] is first file if multiple were selected
    fReader.readAsText(file);
    this.style.display = "none";
}

class Asset {
  constructor(ticker, shares, price, percentChange) {
    this.ticker = ticker;
    this.shares = shares;
    this.price = price;
    this.percentChange = percentChange;
  }
}

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
  if (percentChange < -2.5) {
      return ["#FFFFFF", fillStyles[0]];
  }
  if (percentChange < -2.0) {
      return ["#FFFFFF", fillStyles[1]];
  }
  if (percentChange < -1.5) {
      return ["#000000", fillStyles[2]];
  }
  if (percentChange < -1.0) {
      return ["#000000", fillStyles[3]];
  }
  if (percentChange < -0.5) {
      return ["#000000", fillStyles[4]];
  }
  if (percentChange > 2.5) {
      return ["#FFFFFF", fillStyles[10]];
  }
  if (percentChange > 2.0) {
      return ["#FFFFFF", fillStyles[9]];
  }
  if (percentChange > 1.5) {
      return ["#000000", fillStyles[8]];
  }
  if (percentChange > 1.0) {
      return ["#000000", fillStyles[7]];
  }
  if (percentChange > 0.5) {
      return ["#000000", fillStyles[6]];
  }
  return ["#000000", fillStyles[5]];
}

function drawBorder(ctx, xPos, yPos, width, height, thickness=1)
{
  ctx.fillStyle='#000';
  ctx.fillRect(xPos - (thickness), yPos - (thickness), width + (thickness * 2), height + (thickness * 2));
}
