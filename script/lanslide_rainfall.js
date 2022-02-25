//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Script to extract 30-minute rainfall from NASA GPM IMERG, based on points location and convert it into CSV file. 
//
// Application: Extract 30-minute rainfall in the last 10-days before landslide occurs in certain point. The data
// will use to develop a model or rainfall threshold  for extreme rainfall that could trigger a landslide.
//
// Benny Istanto and Ridwan Mulyadi
// Vulnerability Analysis and Mapping (VAM) unit, WFP Indonesia
// 
// Guruh Samodra
// Department of Environmental Geography, Faculty of Geography, Universitas Gadjah Mada. 
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// List of coordinates from Landslide events
var LS = ee.FeatureCollection("users/bennyistanto/datasets/table/idn_nhr_ls_3308_magelang_2018_p_example");
// LS = LS.filter(ee.Filter.lte('ID', 2)); // lite version

// Load table to layer
Map.addLayer(LS, {color: "#ff0000"}, "Landlside location", true);
Map.centerObject(LS, 10);

// Import NASA GPM IMERG 30 minute data 
var imerg = ee.ImageCollection('NASA/GPM_L3/IMERG_V06');

// Parsing date from CSV
function parseDate(p) {
  var d = p.getNumber('DD');
  var m = p.getNumber('MM');
  var y = p.getNumber('YYYY');
  var dt = y.format('%d')
    .cat('-').cat(m.format('%02d'))
    .cat('-').cat(d.format('%02d'));
  return ee.Date(dt);
}

var result = LS.map(function(p) {
  var id = p.getNumber('ID');
  var point = p.geometry();
  var coord = point.coordinates();
  var dt = parseDate(p);
  var start = dt.advance(-10, 'days'); // 10-days before
  var end = dt.advance(1, 'days'); // 1-day after
  var precipHH = imerg.filterBounds(point)
    .filterDate(start, end)
    .select('precipitationCal');
  var timeSeries = precipHH.map(function(image) {
    var date = image.date().format('yyyy-MM-dd hh:mm');
    var value = image
      .clip(point)
      .reduceRegion({
        reducer: ee.Reducer.mean(),
        scale: 30
      }).get('precipitationCal'); 
    return ee.Feature(null, { 
      coord_id: id, 
      lon: coord.get(0), 
      lat: coord.get(1),
      date: date, 
      value: value
    });
  });
  return timeSeries;
});

var flatResult = ee.FeatureCollection(result).flatten();

// Export the result as CSV in Google Drive
Export.table.toDrive({
  collection: flatResult,
  description:'landslide_rainfall',
  folder:'GEE',
  selectors: 'coord_id, lon, lat, date, value', 
  fileFormat: 'CSV'
});