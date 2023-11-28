const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;

//middlewares
app.use(cors());
app.use(express.json());

//58RTyxwSvmERI7Sp
//bldonors

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.otb80lh.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const userCollection = client.db("BlDonors").collection("users");
    const RequestToDonateCollection = client.db("BlDonors").collection("requestDonate");
    const donationRequestCollection = client
      .db("BlDonors")
      .collection("donationRequests");

    // <---------------- JWT token ---------------->
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1hr",
      });
      console.log("Token: ", token);
      res.send({ token });
    });

    // <---------------- Users ---------------->
    //set User data
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log("user: ", user);
      const query = { email: user.email };
      console.log("Query: ", query);
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists!", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    //middleware to verify access token
    const verifyToken = (req, res, next) => {
      console.log("inside verify token: ", req.headers);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Forbidden access!" });
      }
      const token = req.headers.authorization.split(" ")[1];
      console.log(token);
      // console.log(token);
      if (!token) {
        return res.status(401).send({ message: "Unauthorized access!" });
      }
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: "Unauthorized access!" });
        }
        console.log(decoded);
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin after verify token
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "Admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      console.log("Message: ", req.params.email, req.decoded.email);
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access!" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.get("/users",verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // make a volunteer
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        // console.log(id);
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "Volunteer",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );
    // update user info
    app.put("/users/:id", async (req, res) => {
      const data = req.body;
      console.log("Requested user data for update: ",data);
        const id = req.params.id;
        console.log("Requested user id for update: ",id);
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            name: data.name,
            email: data.email,
            bloodGroup: data.bloodGroup,
            district: data.district,
            upazila: data.upazila,
            status: data.status,
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    app.patch("/users/:id",verifyToken, async (req, res) => {
      const data = req.body;
      const id = req.params.id;

      try {
        const filter = { _id: new ObjectId(id) };
        const update = {
          $set: {
            role: data.role,
            status: data.status,
          },
        };

        const result = await userCollection.updateOne(
          filter,
          update
        );
        return res.send(result);
      } catch (error) {
        console.error("Error confirming user update:", error);
        return res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      }
    });

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/users/info", async (req, res) => {
      const email = req.query.email; // Get email from query parameter
      const query = { email: email };

      try {
        const userInfo = await userCollection.findOne(query);
        if (userInfo) {
          res.send(userInfo);
        } else {
          res.status(404).send({ message: "User not found" });
        }
      } catch (error) {
        console.error("Error retrieving user information:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // donation requests
    //insert donation request
    app.post("/donationRequest", async (req, res) => {
      const donation = req.body;
      console.log(donation);
      const result = await donationRequestCollection.insertOne(donation);
      res.send(result);
    });

    //get donation requests with optional status filter
    app.get("/donationRequest", async (req, res) => {
      const { status } = req.query;
      const filter = status ? { status } : {}; // Apply status filter if provided

      const result = await donationRequestCollection.find(filter).toArray();
      res.send(result);
    });

    //get donation request by _id
    app.get("/donationRequest/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationRequestCollection.findOne(query);
      res.send(result);
    });

    // Confirm donation and update status
    app.patch("/donationRequest/:id",verifyToken, async (req, res) => {
      const data = req.body;
      const id = req.params.id;

      try {
        const filter = { _id: new ObjectId(id) };
        const update = {
          $set: {
            donorName: data.donorName,
            donorEmail: data.donorEmail,
            status: data.status,
          },
        };

        const result = await donationRequestCollection.updateOne(
          filter,
          update
        );
        return res.send(result);
      } catch (error) {
        console.error("Error confirming donation:", error);
        return res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      }
    });

    //edit donation request
    app.put("/donationRequest/:id", async (req, res) => {
      const data = req.body;
      console.log(data);
      const id = req.params.id;
    
      try {
        const filter = { _id: new ObjectId(id) };
        const update = {
          $set: {
            requesterName: data.requesterName,
            requesterEmail: data.requesterEmail,
            recipientName: data.recipientName,
            hospitalName: data.hospitalName,
            fullAddress: data.fullAddress,
            bloodGroup: data.bloodGroup,
            district: data.district,
            upazila: data.upazila,
            date: data.date,
            time: data.time,
            donationStatus: data.donationStatus,
            status: data.status,
          },
        };
        const result = await donationRequestCollection.updateOne(
          filter,
          update
        );
        console.log("Result: ", result);
        return res.send(result);
      } catch (error) {
        console.error("Error updating donation:", error);
        return res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      }
    });
    app.delete("/donationRequest/:id", async (req, res) => {
      const id = req.params.id;
      const query = {_id : new ObjectId(id)};
      const result = await donationRequestCollection.deleteOne(query)
      res.send(result)
    }
    )

    // Request to donate (Donor side)
    app.post("/requestDonate",verifyToken, async (req, res) => {
      const donation = req.body;
      console.log(donation);
      const result = await RequestToDonateCollection.insertOne(donation);
      res.send(result);
    });
    
    app.get("/requestDonate",verifyToken, async (req, res) => {
      const { status } = req.query;
      const filter = status ? { status } : {}; // Apply status filter if provided

      const result = await RequestToDonateCollection.find(filter).toArray();
      res.send(result);
    });
    app.get("/requestDonate/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await RequestToDonateCollection.findOne(query);
      res.send(result);
    });

    

    // donation request cart


















    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Open for Donation!");
});
app.listen(port, () => {
  console.log("Donation campaign is running on port: ", port);
});
