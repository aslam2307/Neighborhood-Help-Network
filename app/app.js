// Import express.js
const express = require("express");

// Create express app
var app = express();

// Add static files location
app.use(express.static("static"));

// Use the Pug templating engine
app.set('view engine', 'pug');
app.set('views', './app/views');

// Get the functions in the db.js file to use
const db = require('./services/db');

// Create a route for root - /
app.get("/", function(req, res) {
    // Set up an array of data
    var test_data = ['one', 'two', 'three', 'four'];
    // Send the array through to the template as a variable called data
    res.render("index", {'title':'My index page', 'heading':'My heading', 'data':test_data});
});

// Create a route for testing the db
app.get("/db_test", function(req, res) {
    // Assumes a table called test_table exists in your database
    sql = 'select * from test_table';
    db.query(sql).then(results => {
        console.log(results);
        res.send(results)
    });
});

// Task 2 display a formatted list of students
app.get("/all_requests", function(req, res) {
    var sql = `select user.User_ID, user.User_name, request.request_type, request.request_date, 
    request.request_location, request.profile, request.summary
    from request JOIN user ON request.User_ID = user.User_ID`;
    db.query(sql).then(results => {
    	    // Send the results rows to the all-students template
    	    // The rows will be in a variable called data
        res.render('all-students', {data: results});
    });
});


app.get("/request_details/:User_ID", function(req, res) {
    let userId = req.params.User_ID;

    let sql = `
        SELECT user.User_ID, user.User_name, request.request_type, request.request_date, request.request_location 
    ,request.profile, request.summary
        FROM request 
        JOIN user ON request.User_ID = user.User_ID
        WHERE user.User_ID = ?`;

    db.query(sql, [userId]).then(results => {
        if (results.length > 0) {
            res.render('request_details', { user: results[0]});
        } else {
            res.status(404).send("User not found");
        }
    }).catch(error => {
        res.status(500).send("Database error: " + error);
    });
});


// Create a route for /goodbye
// Responds to a 'GET' request
app.get("/goodbye", function(req, res) {
    res.send("Goodbye world!");
});

// Create a dynamic route for /hello/<name>, where name is any value provided by user
// At the end of the URL
// Responds to a 'GET' request
app.get("/hello/:name", function(req, res) {
    // req.params contains any parameters in the request
    // We can examine it in the console for debugging purposes
    console.log(req.params);
    //  Retrieve the 'name' parameter and use it in a dynamically generated page
    res.send("Hello " + req.params.name);
});

// Start server on port 3000
app.listen(3000,function(){
    console.log(`Server running at http://127.0.0.1:3000/`);
});