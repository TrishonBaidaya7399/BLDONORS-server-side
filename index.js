const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;

//middlewares
app.use(cors());
app.use(express.json());



app.get("/", (req, res)=>{
    res.send("Open for Donation!")
})
app.listen(port, ()=>{
    console.log("Donation campaign is running on port: ", port);
})