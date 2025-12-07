require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECURET);
const app = express();

const admin = require("firebase-admin");

const decoded = Buffer.from(
  process.env.FIRE_BASE_SECURET_KEY,
  "base64"
).toString("utf-8");
const serviceAccount = JSON.parse(decoded);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyJWT = async (req, res, next) => {
  const token = req?.headers?.authorization?.split(" ")[1];
  console.log(token);
  if (!token) return res.status(401).send({ message: "Unauthorized Access!" });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.tokenEmail = decoded.email;
    console.log(decoded);
    next();
  } catch (err) {
    console.log(err);
    return res.status(401).send({ message: "Unauthorized Access!", err });
  }
};
//======= middleware ===========//
app.use(express.json());
app.use(
  cors({
    origin: [process.env.CLIENT_DOMIN],
    credentials: true,
    optionSuccessStatus: 200,
  })
);

//========= firebase ========//

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
    const orderCollection = db.collection("orders");
    const paymentCollection = db.collection("payments");

    //========= User api ============//
    app.get("/all-users/:email", async (req, res) => {
      const adminEmail = req.params.email;
      const result = await userCollection
        .find({ email: { $ne: adminEmail } })
        .toArray();
      res.send(result);
    });

    // GET /user/role?email=user@example.com
    app.get("/user/role", async (req, res) => {
      const email = req.query.email;
      if (!email) return res.status(400).send({ error: "Email is required" });

      const user = await userCollection.findOne({ email });
      if (!user) return res.status(404).send({ error: "User not found" });

      res.send({ role: user.role });
    });

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

    // user profile update
    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateUser = req.body;
      const updateProfile = { name: updateUser.name, image: updateUser.image };
      const updateDoc = { $set: updateProfile };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //User Role Update
    app.patch("/user-role", async (req, res) => {
      const email = req.body.email;
      const query = { email: email };
      const roleUpdate = req.body;
      const updateDoc = {
        $set: {
          role: roleUpdate.role,
        },
      };
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
          status: req.body.status,
        },
      };
      const result = await bookCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //====== Order Boook ========//
    app.get("/orders/:email/payments", async (req, res) => {
      const email = req.params.email;
      const result = await orderCollection
        .find({ customerEmail: email, paymentStatus: "paid" })
        .toArray();
      res.send(result);
    });

    app.get("/orders/:email", async (req, res) => {
      const email = req.params.email;
      const result = await orderCollection
        .find({ customerEmail: email })
        .toArray();
      res.send(result);
    });

    app.post("/orders", async (req, res) => {
      const newOrder = req.body;
      newOrder.status = "pending";
      newOrder.paymentStatus = "unpaid";
      newOrder.order_date = new Date();
      const result = await orderCollection.insertOne(newOrder);
      res.send(result);
    });

    app.patch("/order/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const statusUpdate = req.body;

      const updateDoc = {
        $set: { status: statusUpdate.status },
      };

      const result = await orderCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //==== payment releted api ========//
    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      const amount = parseInt(paymentInfo.price) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: amount,
              product_data: {
                name: paymentInfo.name,
              },
            },

            quantity: 1,
          },
        ],
        customer_email: paymentInfo.customerEmail,
        mode: "payment",
        metadata: {
          orderId: paymentInfo._id,
        },
        success_url: `${process.env.SITE_DOMIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMIN}/dashboard/my-orders`,
      });
      res.send({ url: session.url });
    });

    app.patch("/payment-success", async (req, res) => {
      const sessionId = req.query.session_id;

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      const orderId = session?.metadata?.orderId;
      const orderQuery = { _id: new ObjectId(orderId) };

      const books = await orderCollection.findOne(orderQuery);

      const existingPayment = await paymentCollection.findOne({
        transationId: session.payment_intent,
      });

      if (existingPayment) {
        return res.send({
          message: "Payment already processed",
          transationId: existingPayment.transationId,
        });
      }

      if (session.payment_status === "paid" && books) {
        const orderInfo = {
          orderId: orderId,
          transationId: session.payment_intent,
          bookName: books.name,
          authorName: books.authorName,
          authorEmail: books.authorEmail,
          customer_email: session.customer_email,
          customer_name: books.customerName,
          payment_date: new Date(),
          status: books.status,
          price: session.amount_total / 100,
        };

        const result = await paymentCollection.insertOne(orderInfo);

        await orderCollection.updateOne(orderQuery, {
          $set: { paymentStatus: session.payment_status },
          $inc: { quantity: -1 },
        });

        return res.send({
          transationId: session.payment_intent,
          orderId: result.insertedId,
        });
      }

      res.send({
        transationId: session.payment_intent,
        orderId: result._id,
      });
    });

    //===== payment =======//
    app.get("/payments/:email", async (req, res) => {
      const email = req.params.email;
      const result = await paymentCollection
        .find({ customer_email: email })
        .sort({ payment_date: -1 })
        .toArray();
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
