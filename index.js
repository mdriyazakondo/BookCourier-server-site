require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();

//======= middleware ===========//
app.use(express.json());
app.use(
  cors({
    origin: [process.env.CLIENT_DOMIN],
    credentials: true,
    optionSuccessStatus: 200,
  })
);

//========= mongodb connect =========//
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("BookCourier_Library_System");
    const userCollection = db.collection("users");
    const bookCollection = db.collection("books");

    //========= User api ============//
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const newUser = req.body;
      newUser.create_date = new Date();
      newUser.last_loggedIn = new Date();
      newUser.role = "customer";
      const query = { email: newUser.email };
      const alreadyExist = await userCollection.findOne(query);
      if (alreadyExist) {
        const updateUser = await userCollection.updateOne(query, {
          $set: { last_loggedIn: new Date() },
        });
        return res.send(updateUser);
      }
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });

    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateUser = req.body;
      const updateProfile = { name: updateUser.name, image: updateUser.image };
      const updateDoc = { $set: updateProfile };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //========= latest books ===========//
    app.get("/latest", async (req, res) => {
      const result = await bookCollection
        .find()
        .sort({ create_date: -1 })
        .limit(8)
        .toArray();
      res.send(result);
    });

    //============ book create releted api ===========//
    app.get("/books", async (req, res) => {
      const result = await bookCollection
        .find()
        .sort({ create_date: -1 })
        .toArray();
      res.send(result);
    });

    app.get("/books/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookCollection.findOne(query);
      res.send(result);
    });

    app.post("/books", async (req, res) => {
      const newBook = req.body;
      newBook.create_date = new Date();
      const result = await bookCollection.insertOne(newBook);
      res.send(result);
    });

    app.put("/books/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateBook = req.body;
      const updateDoc = { $set: updateBook };
      const result = await bookCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.delete("/books/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookCollection.deleteOne(query);
      res.send(result);
    });

    //==== publish and unpublish =========//
    app.patch("/books/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          create_date: new Date(),
          status: req.body.status,
        },
      };
      const result = await bookCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

//========= port and litsene ========//
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`server is running port : ${port}`);
});
