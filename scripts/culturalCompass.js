/* Gunas.2.0.js
Script for visualizing a cultural accounting system. 
Beta version, 5/2016 */

//function to parse JSON representation of the Google sheet. Uses an older schema -- may this need updating at some point?
//Credit: https://github.com/scottbw/Google-SpreadSheet-to-D3-Dataframe/blob/master/data.js
function mapEntries(json){

  var dataframe = new Array();
  
  var row = new Array();
  for (var i=0; i < json.feed.entry.length; i++) {

    var entry = json.feed.entry[i];
    if (entry.gs$cell.col == '1') {
      if (row.length > 0) {
           dataframe.push(row);
        }

      var row = new Array();
    }
    row.push(entry.content.$t);
  } 
  dataframe.push(row);
  
  dataLoaded(dataframe);
}

//function to create a downloadable csv file of the updated data
function saveData() {
	var dataTable = [];

	d3.selectAll("tbody tr").each(function (d) {
		var thisRow = [];
		d3.select(this).selectAll("td").each(function (dd) {
			var textInput = d3.select(this).text();
			thisRow.push(textInput)
		});
		dataTable.push(thisRow);
	});
	download(dataTable);
}

function download(data) {
	
	var csvContent = "data:text/csv;charset=utf-8,";
	
	data.forEach(function(row, index){
   		var dataString = row.join(",");
   		csvContent += index < data.length ? dataString+  "\n" : dataString;
	});

	var encodedUri = encodeURI(csvContent),
		link = document.getElementById("download");
	
	link.setAttribute("href", encodedUri);
	link.setAttribute("download", "cultural_compass.csv");
	link.click();
	
}

var width = 960,
	height = 500,
	radius = Math.min(width, height) / 2 - 10, // leave a margin around the circle for the handle
	handleR = 10 // radius for the small circle used as a handle to move the arrows

// initialize the color scale for the parts of the circle
var color = d3.scale.category20c();

// initialize the linear scale for the radial length of each arrow (indicator)
var r = d3.scale.linear()
			.range([0, radius])
			.domain([0, 1]);	// since the rValue is a percentage, the domain (for input to the linear scale) is 0 and 1

// initialize the arc constructor for the circle
var arc = d3.svg.arc()
			.outerRadius(radius - 10)
			.innerRadius(0);

// initializate the layout constructor for the divisions of the circle
var pie = d3.layout.pie()
			.sort(null)
			.value(function (d) {
				return d.value;
			})

// initialize the canvas
var svg = d3.select("#chart").append("svg")
			.attr("width", width)
			.attr("height", height)
			.append("g")
			.attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

var line = d3.svg.line();


var arrowGlyph = d3.svg.symbol().type("triangle-up").size(120)

// store the data-table headers / keys for the data map
var headers; 

//store the data-table headers that take numerical values for type conversion
var numericElems = ["value", "rangeMin", "rangeMax"];

// global variable for the current dataset
var dataMap = new Object();


// defines the data for the circle. The keys will be used to match indicators to their portion of the circle
//TO DO: extract this from the data itself
var arcs, 
	 catAngles = {};

var draggable = d3.behavior.drag();

function drawPie(data) {
//retrieve the categories from the data. Send alert if there are more than three.
	var gunas = data.reduce(function (prev, curr) {
							if (prev.indexOf(curr.category) < 0) {
								prev.push(curr.category);
							}
							return prev; 
						}, []).reduce(function (prev, curr) {
							prev.push({"key": curr, "value": 100})
							return prev;
						}, []);

	if (gunas.length > 3) {
		alert("We're sorry! Your model has more than three categories. Only three categories are supported");
	}
// draw the circle
	arcs = svg.selectAll(".arc").data(pie(gunas))
			.enter()
			.append("g")
			.attr("class", "arc")

	arcs.append("path")
				.attr("d", arc)
				.style("fill", function (d, i) {
					return color(i);
				});

	arcs.append("text")
    	.attr("transform", function (d) { 
    		return "translate(" + arc.centroid(d) + ")"; 
    	})
    	.attr("dy", ".35em")
    	.attr("text-anchor", "middle")
    	.text(function (d) { 
    		return d.data.key; 
    	})
    	.attr("class", "labels")
    	.style("fill", "white")
    	.style("font-size", "24");

	// compute the bisecting angle of each arc
	arcs.each(function (arc) {
		catAngles[arc.data.key] = (arc.endAngle - arc.startAngle) / 2 + arc.startAngle;
	});	

}

//object -> each indicator
function dataObj (arr) {
	for (var i = 0; i < arr.length; i++) {
		var h = headers[i],
			v = arr[i];
		if (h) {
			this[h] = v;	
		}
		else {
			this.key = v; 	// the unique numeric key for each indicator object
		}
  	}
	
	this._origin = {x: 0,
					y: 0};

	//getter for x & y computes the endpoints of the vector on the fly, based on the origin and the magnitude
	Object.defineProperty(this, "x", {
    	get: function () { 
    		return (Math.cos(this.angle - Math.PI / 2) * r(this.rValue)) + this._origin.x;  
	    }

	});

	Object.defineProperty(this, "y", {
    	get: function () { 
    		return (Math.sin(this.angle - Math.PI / 2) * r(this.rValue)) + this._origin.y;  
	    }
	    
	});

	Object.defineProperty(this, "origin", {
    	set: function (coords) { 
    		this._origin.x = coords[0]; 
    		this._origin.y = coords[1]; 
    	},
    	get: function () {
    		return [this._origin.x, this._origin.y];
    	}
	});
	
	return this;
}

//initialize the values for plotting the indicator arrows, computing the value of each indicator as a percentage of its position in its range and compute the starting angle for each indicator based on its category (if not already set) and its relative length (as a percentage of a range of values)
// TODO spread angles evenly close to the center
// TODO Implement error checking on the range of angles allowed per sector
dataObj.prototype.init = function () {
	if ((this.value < this.rangeMin) || (this.value > this.rangeMax)) {
		alert("Value for " + this.indicator + " outside of range!")
	}
	
	else { 
		this.rValue = (this.value - this.rangeMin) / (this.rangeMax - this.rangeMin);
		if (!this.angle) {
			this.angle = catAngles[this.category];
		}
	
		this.origin = [0, 0];
	}

	return this;
}	


//remove non-numeric characters and convert values to numbers
dataObj.prototype.clean = function () {
	numericElems.forEach(function (e) {
		var p = +this[e];
		if (isNaN(p)) {
			// removes dollar signs and other extraneous signs
			// TO DO: Do we need to allow for negative values??
			this[e] = +(this[e].replace(/[^0-9\.]+/g,""));
		}
		else {
			this[e] = p;
		}
	}, this);

	return this;
}

dataObj.prototype.update = function (d) {

	if (d.key == 'angle') {
		this[d.key] = radians(d.value);
	} 
	else {
		this[d.key] = d.value;
	}

	this.reset();
	return this;
}

dataObj.prototype.reset = function () {

	this.origin = [0, 0];
	this.clean().init();
	
	return this;
}

//helper functions to manage polar to Cartesian coordinates, etc.
function coordinates (angle, radius) {
	angle = angle - Math.PI / 2;
	return {x: Math.cos(angle) * radius,
	    	y: Math.sin(angle) * radius};	
}

function degrees(angle) {
	return angle * 180 / Math.PI;
}

function radians(angle) {
	return angle * Math.PI / 180;
}

// helper function to test for numerical data
function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

// convert the 2-D array (data table) into an array of object for use in constructing the indicator graphics
function initDataMap(data) {
	var dataMap = new Array();

	data.forEach(function (values) {
		dataMap.push(new dataObj(values).clean());//.init());
	});
	return dataMap;
}

//display an editable table of values for the indicators
//TO DO: Re-do using the array of dataObj's instead of the initial 2-D array
function dataTable (data) {

	data.forEach(function (d) {
		d.init();
	});

	var table = d3.select("#table")
				.append("table");

	table.append("thead")
		.append("tr")
		.selectAll("td")
		.data(headers)
		.enter()
		.append("td")
		.text(function (d) {
			return d;
		})

//TO DO: make key function depend on a unique ID (a la SQL), in case a user creates two indicators with the same name
	table.append("tbody")
		.selectAll("tr")
		.data(data)
		.enter()
		.append("tr")
		.selectAll("td")
		.data(function (d) { 						//re-do this in a more functional style, using reduce??
			dArr = [];								// Or just use the map function, and let D3 skip the undefined values?
			for (i = 0; i < headers.length; i++) {
				h = headers[i];
				dArr.push({"key": h,
						   "value": d[h]});	
			}
			return dArr;
		})
		.enter()
		.append("td")
		.property("contentEditable", "true")
		.attr("class", "dataCells")
		.text(printValues)
		.on("input", updateData); // call this function on this table cell
 }

 function makeButtons () {

 	var button = d3.select("#saveButton");

	button.append("button")
		.attr("id", "saveButton")
		.text("Save Data")
		.on("click", saveData);

	var buttons = d3.select("#graphButtons")

	buttons.append("button")
		.text("Reset")
		.on("click", reset);

	buttons.append("button")
		.attr("id", "sumButton")
		.text("Sum Indicators")
		.on("click", sumVectors); 

	buttons.append("button")
		.attr("id", "integrateButton")
		.text("Integrate")
		.on("click", drawIntegration); 	
}


//TO DO: Add option to add indicators




function updateData() {
	
	var cell = d3.select(this),				// get the selection corresponding to the cell to be updated
		row = d3.select(this.parentNode), // select the row in which the cell is nested
		key = row.datum().key,				//retrieve the unique identifier for this row
		value = cell.text();	// update the cell's value (a key, value pair)
	
	if ((!value) || ((numericElems.indexOf(key) > -1) && !isNumber(value))) {
		return null;			// Do nothing is the cell is blank or non-numerical in a numeric cell (e.g., while the user is typing)
	}
 
 	cell.datum().value = value;

	dataMap[key].update(cell.datum());	// update the global data map with this object
	row.datum(dataMap[key]);			// update the row's data for consistency

	drawArrows();
	
}

function reset () {

	dataMap.forEach(function (obj) {
		obj.reset();
	});

	drawArrows();

	d3.selectAll(".arrow")
		.style("stroke", "white")
		.style("stroke-dasharray", 0)
		.call(drawArrow);

	d3.selectAll(".arrowhead")
		.style("fill", "white");

	
	d3.selectAll(".intVector").remove();
	d3.selectAll(".intArrow")
		.style("opacity", .3);

}

function deleteRow() {} 	// TO DO

function drawArrows () {
	
	d3.selectAll(".arrow").remove();
	d3.selectAll(".arrowhead").remove();

	var arrows =  svg.selectAll(".arrow").append("g")
					.data(dataMap, function (d) {
						return d.key;			// key function for the updates
					})
		
	arrowsEnter = arrows.enter()					//add any new arrows
			.append("g")
			.append("path")
			.attr("class", "arrow")
			.style("stroke", "#ffffff")
			.style("stroke-width", 6)
			.call(drawHeads, "white")
			.call(drawArrow)
}


function drawHeads(arrow, color) {
	arrow.each(function (d) {
		d3.select(this.parentNode).append("path")
			.attr("class", "arrowhead")
			.attr("transform", function (d) {
				return "translate(" + d.x + ", " + d.y + ")" + " rotate(" + degrees(d.angle) + ")";
			})
			.attr("d", arrowGlyph)
			.style("fill", color);
	});
}

function drawArrow(arrow) {
	arrow.attr("d", function (d) {
			return line([d.origin, [d.x, d.y]]);

		})
		.each(function (d) {
			d3.select(this.parentNode).select(".arrowhead")
				.call(drawHead)
				.call(draggable);
		});
								// DRY function for updating the position of the arrow
}

function drawHead(head) {
	head.attr("transform", function (d) {
							return "translate(" + d.x + ", " + d.y + ")" + " rotate(" + degrees(d.angle) + ")";
						}); 
}

//TO DO: Stop the indicator from flipping to the other side if the user drags it to far in one direction (rotations)
draggable.on("drag", function (d) {

	            var thisRow = d3.selectAll("tbody tr").filter(function (dd) {
	       							return dd.key == d.key; 							// access the current row of the data table
	    						}),
					angleCell = thisRow.selectAll("td").filter(function (dd) {
									return dd.key == "angle";								// access the cell representing the angular measure
	    						});	

				thisRow.selectAll(".dataCells").style("background", "yellow");


	            var arc = arcs.filter(function (dd) {
								return dd.data.key == d.category;		//the arc matching this category
							}),
	            	head = d3.select(this),
	            	arrow = d3.select(this.parentNode).select(".arrow")
	            	startAngle = arc.datum().startAngle,
					endAngle = arc.datum().endAngle;
	            var theta,
	            	dx = d3.event.x,							//mouse events corresponding the location of the pointer in Cartesian space
	            	dy = d3.event.y,
	            	dAngle = Math.atan2(dy, dx) + radians(90); // correct for polar orientation by adding 90 degrees
	            
	            if ((startAngle >= radians(180)) && (degrees(dAngle) <= 180)) {  // necessary to account for negative values in the 4th quadrant
	            	dAngle = dAngle + radians(360);
	            }
	            
	            if (dAngle > startAngle && dAngle < endAngle) {
	            	theta = dAngle;
	            }
	            else {
	            	 theta = Math.min(endAngle, Math.max(dAngle, startAngle));
	            }
	            d.angle = theta;
         		head.style("fill", "red");
         		arrow.call(drawArrow);
         		arrow.style("stroke", "red")

	          	angleCell.datum({key: "angle",
	        					 value: d.angle})			  // update the "angle" cell in the table */
	            		.text(printValues);
	        });

draggable.on("dragend", function (d) {
		d3.selectAll(".dataCells").style("background", "white");
		d3.select(this).style("fill", "white");
		d3.select(this.parentNode).select(".arrow").style("stroke", "white");
	})
	

function printValues (d) {
	if (d.key == "angle") return Math.round(degrees(d.value));			// convert radians to degrees to ease comprehension
	else return d.value;												// could embed a check for displayed headers
}



//TO DO: turn off drag listener
function sumVectors () {

	var lastPoints = {};

	var arrows = d3.selectAll(".arrow").transition().duration(500)

	// by setting the origin of each arrow to the endpoints of the previous (as computed dynamically by the underlying dataObj), we can add the vectors end to end
	arrows.each(function (d) {
		if (!lastPoints[d.category]) {
			lastPoints[d.category] = [d.x, d.y];
		}
		else {
			d.origin = lastPoints[d.category];
			lastPoints[d.category] = [d.x, d.y];
		}
	});

	arrows.call(drawArrow)
		.style("stroke", "grey")
		.style("stroke-dasharray", [5, 5]);

	d3.selectAll(".arrowhead")
		.style("fill", "grey")

	
}


function drawIntegration () {

	// find the endpoint of the summed arrows 
	var vertices = d3.selectAll(".arrow")[0]
						.reduce(function (prev, curr) { 
							var datum = d3.select(curr).datum(),
								category = datum.category,
								vertex = [datum.x, datum.y];
							if (!prev[category]) {
								prev[category] = vertex;
							} 
							else {
								prev[category] = ((Math.abs(prev[category][0]) <= Math.abs(vertex[0])) && (Math.abs(prev[category][1]) <= Math.abs(vertex[1]))) ? vertex : prev[category];
							}
							return prev; 
						}, {});
	vertices = d3.values(vertices);
	console.log(vertices)

	// compute the centroid of the triangle so formed
	var centre = d3.geom.polygon(vertices).centroid();

	//draw the triangle with transitions and then the integrated vector
	d3.transition()
    	.duration(3000)
    	.ease("linear")
   		.each(function () {
   			var tri = svg.append("path").attr("class", "intVector")
						.attr("fill", "none")
						.attr("d", function (d) { 
							return line(vertices) + "Z";
						})
						.style("stroke", "red")
						.style("opacity", ".5")
						.style("stroke-width", 6)
						.call(vecTransition);
        })	
        .transition()
        .duration(300)
   		.each("end", function() {
      		var intVector = svg.append("path")
    							.attr("class", "intArrow")
    							.style("stroke", "red")
    							.style("opacity", 1)
    							.style("stroke-width", 6)
    							.attr("d", line([[0, 0], centre]))
    							.call(vecTransition);	
    
      		var dAngle = Math.atan2(centre[1], centre[0]) + radians(90),
    			intHead = svg.append("path")
						.attr("class", "intArrow")
						.attr("transform", function (d) {
							return "translate(" + centre[0] + ", " + centre[1] + ")" + " rotate(" + degrees(dAngle) + ")";
						})
						.attr("d", arrowGlyph)
						.style("fill", "red")					
						.style("opacity", 0);

			intHead.transition()
					.style("opacity", 1);
    	});
}


function vecTransition(vector, t) {
	
	t = (t) ? t : 0;

	var totalLength = vector.node().getTotalLength();

	vector.attr("stroke-dasharray", totalLength + " " + totalLength)
    	  	.attr("stroke-dashoffset", totalLength);

	vector.transition().delay(t)
        	.attr("stroke-dashoffset", 0);
}

function test() {
	var testObjs = d3.selectAll(".arrow");
	testObjs.each(function (d) {
		coors = coordinates(d.angle, r(d.rValue));
		console.log(d3.select(this).attr("d"));
		console.log(coors.x, coors.y);
	});
}


// load the initial data from a csv file, converting strings to numerical values
function dataLoaded(data) {

	headers = data[0];
	data = data.slice(1);
	data.forEach(function (d, i) {
		d.push(i);			// add a unique numeric key to each row
	});
	dataMap = initDataMap(data);

	drawPie(dataMap);
	headers.push('angle');
	dataTable(dataMap);
	makeButtons();
 	drawArrows();
};
