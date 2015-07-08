// This is a template for a Node.js scraper on morph.io (https://morph.io)
var cheerio = require('cheerio');
var entities = require('entities');
var request = require("request");
var sqlite3 = require("sqlite3").verbose();

function initDatabase(callback) {
	// Set up sqlite database.
	var db = new sqlite3.Database("data.sqlite");
	db.serialize(function() {
		db.run("CREATE TABLE IF NOT EXISTS data (id INTEGER, name TEXT, region TEXT, lat INTEGER, lon INTEGER, hours TEXT, address TEXT, phone TEXT, fax TEXT, rawContact TEXT, rawHours TEXT, rawHolidayHours TEXT)");
		callback(db);
	});
}

function updateRow(db, value) {
	// Insert some data.
	var statement = db.prepare("INSERT INTO data VALUES ($id,$name,$region,$lat,$lon,$hours,$address,$phone,$fax,$rawContact,$rawHours,$rawHolidayHours)");
	statement.run(value);
	statement.finalize();
}

function readRows(db) {
	// Read some data.
	db.each("SELECT rowid AS id, name FROM data", function(err, row) {
		console.log(row.id + ": " + row.name);
	});
}

function fetchPage(url, callback) {
	// Use request to read in pages.
	request(url, function (error, response, body) {
		if (error) {
			console.log("Error requesting page: " + error);
			return;
		}

		callback(body);
	});
}

function run(db) {
	// Use request to read in pages.
	fetchPage("http://www.countdown.co.nz/our-stores/StoreJsonDetails", function (body) {

		JSON.parse(body).Areas.Area.forEach(function(area){
			area.Store.forEach(function(store){

				var data = {};
				var hours = [];
				var faxMatch;
				var contact;

				// hours
				var $hours = cheerio.load(entities.decode((store.storeOpenHours)));
				$hours('p,div').each(function(){
					hours.push($hours(this).text());
				});
				data.$hours = hours.filter(function(d){ return !!d.trim(); }).join('; ');

				//
				contact = entities.decode(store.storeContactDetails).replace(/<br \/>/g, ' ');
				$contact = cheerio.load(contact);
				data.$address = $contact('p').first().text().split('  ')[0];
				data.$phone = $contact('*').text().match(/Ph(one)?\s?:?\s?(\(?\s?[0-9]{2}\)?\s?[0-9]{3}\s?[0-9]{4})/)[2];
				faxMatch = $contact('*').text().match(/Fax\s?:?\s?(\(?\s?[0-9]{2}\)?\s?[0-9]{3}\s?[0-9]{4})/);
				data.$fax = faxMatch ? faxMatch[1] : '';

				data.$id = store.storeId;
				data.$name = store.storeName;
				data.$region = store.storeRegionName;
				data.$lat = store.lat;
				data.$lon = store.lon;
				data.$rawContact = store.storeContactDetails;
				data.$rawHours = store.storeOpenHours;
				data.$rawHolidayHours = store.storeHolidayHours;

				updateRow(db, data);

			});
		});

		db.close();

	});
}

initDatabase(run);
