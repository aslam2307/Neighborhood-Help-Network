const express = require("express");
var app = express();
const session = require('express-session');
const bcrypt = require('bcryptjs');


// Middleware
app.use(express.static("static"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set('view engine', 'pug');
app.set('views', './app/views');

const db = require('./services/db');

app.use(session({
    secret: 'super-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true if using https
      httpOnly: true, // For security
      maxAge: 24 * 60 * 60 * 1000 // 1 day cookie lifespan
    }
  }));
  

// Authentication Middleware
function authMiddleware(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect("/login");
    }
}

// Routes

app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/register", async (req, res) => {
    const { name, email, address, contact, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            `INSERT INTO login (name, email, address, contact, password) VALUES (?, ?, ?, ?, ?)`,
            [name, email, address, contact, hashedPassword]
        );
        res.redirect("/login");
    } catch (err) {
        console.error("Registration error:", err);
        res.status(500).send("Registration failed");
    }
});

app.get("/login", (req, res) => {
    res.render("login");
});
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      console.log("Login attempt with email:", email);  // Log email for debugging
      const [user] = await db.query(`SELECT * FROM login WHERE email = ?`, [email]);
  
      if (user && await bcrypt.compare(password, user.password)) {
        req.session.user = user;
        console.log("Login successful, session user set:", user);
        res.redirect("/all_requests");
      } else {
        console.log("Invalid login attempt");
        res.render("login", { error: "Invalid email or password" });
      }
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).render("login", { error: "Server error, try again." });
    }
  });
  

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/login");
    });
});

// Create Request
app.get("/create_request", authMiddleware, (req, res) => {
    res.render("create_request");
});

app.post("/create_request", authMiddleware, async (req, res) => {
    const { user_name, user_email, request_type, request_date, request_location, summary } = req.body;
    try {
        const userResult = await db.query(
            `INSERT INTO user (User_name, User_Email) VALUES (?, ?)`,
            [user_name, user_email]
        );

        const newUserId = userResult.insertId;

        await db.query(
            `INSERT INTO request (User_ID, request_type, request_date, request_location, summary)
            VALUES (?, ?, ?, ?, ?)`,
            [newUserId, request_type, request_date, request_location, summary]
        );

        res.redirect("/all_requests");
    } catch (error) {
        console.error("Create Request error:", error);
        res.status(500).send("Internal server error.");
    }
});

// Show all requests
app.get("/all_requests", authMiddleware, async (req, res) => {
    try {
        const results = await db.query(`
            SELECT user.User_ID, user.User_name, request.request_type, request.request_date, request.request_location, request.summary
            FROM request 
            JOIN user ON request.User_ID = user.User_ID
        `);
        res.render("request", { data: results });
    } catch (error) {
        console.error("Fetching requests error:", error);
        res.status(500).send("Internal server error.");
    }
});

// Request Details
app.get("/request_details/:User_ID", authMiddleware, async (req, res) => {
    const { User_ID } = req.params;
    try {
        const [user] = await db.query(`
            SELECT user.User_ID, user.User_name, request.request_type, request.request_date, request.request_location, request.summary
            FROM request 
            JOIN user ON request.User_ID = user.User_ID
            WHERE user.User_ID = ?
        `, [User_ID]);

        if (user) {
            res.render("request_details", { user });
        } else {
            res.status(404).send("Request not found");
        }
    } catch (error) {
        console.error("Request details error:", error);
        res.status(500).send("Internal server error.");
    }
});

// Accept Request
app.post("/accept_request/:User_ID", async (req, res) => {
    const userId = req.params.User_ID;
  
    try {
      // 1. Get the request details
      const getRequestDetailsSQL = `
        SELECT user.User_name, user.User_Email, request.request_type, 
               request.request_date, request.request_location, request.summary
        FROM request 
        JOIN user ON request.User_ID = user.User_ID 
        WHERE user.User_ID = ?`;
  
      const results = await db.query(getRequestDetailsSQL, [userId]);
  
      if (results.length === 0) {
        return res.status(404).send("Request not found");
      }
  
      const request = results[0];
      console.log("Request to be accepted:", request); // Log request details
  
      // 2. Insert into neighbors table
      const insertNeighborSQL = `
        INSERT INTO neighbors (neighbor_name, neighbor_email, request_type, request_date, request_location, summary) 
        VALUES (?, ?, ?, ?, ?, ?)`;
  
      await db.query(insertNeighborSQL, [
        request.User_name,
        request.User_Email,
        request.request_type,
        request.request_date,
        request.request_location,
        request.summary,
      ]);
      console.log("Request inserted into neighbors table.");
  
      // 3. Delete from request table
      const deleteRequestSQL = `DELETE FROM request WHERE User_ID = ?`;
      await db.query(deleteRequestSQL, [userId]);
      console.log("Request deleted from request table.");
  
      // Redirect to all requests page after success
      res.redirect("/all_requests");
  
    } catch (error) {
      console.error("Error accepting request:", error);
      // Ensure a proper response when an error occurs
      res.status(500).send("Database error: " + error.message);
    }
  });
  
  
// My Neighbors
app.get("/my_neighbors", async (req, res) => {
    try {
      // Ensure user is logged in before showing neighbors
      if (!req.session.user) {
        return res.redirect("/login");
      }
  
      // Fetch the neighbors from the database
      const sql = `SELECT * FROM neighbors`;
      const neighbors = await db.query(sql);
  
      if (neighbors.length === 0) {
        console.log("No neighbors found.");
        res.render("my_neighbors", { neighbors: [] });
      } else {
        res.render("my_neighbors", { neighbors });
      }
    } catch (error) {
      console.error("Error fetching neighbors:", error);
      res.status(500).send("Database error: " + error.message);
    }
  });
  

// About & Help
app.get("/about", authMiddleware, (req, res) => {
    res.render("about");
});

app.get("/help", authMiddleware, (req, res) => {
    res.render("help");
});

// Default error handling
app.use((req, res) => {
    res.status(404).send("Page not found!");
});

// Start server
app.listen(3000, () => {
    console.log(`Server running at http://127.0.0.1:3000/`);
});
