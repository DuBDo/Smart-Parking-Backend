const http = require("http");
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const authRouter = require("./routes/auth.routes");
const driverRouter = require("./routes/driver.routes");
const parkingRouter = require("./routes/parkinglot.routes");
const bookingRouter = require("./routes/booking.routes");
const paymentRouter = require("./routes/payment.routes");
const chatRouter = require("./routes/message.routes");

require("./config/passport");

dotenv.config();

const app = express();
const server = http.createServer(app);
const startBookingWorker = require("./workers/bookingStatusWorker");

const { Server } = require("socket.io");
const { getUsers } = require("./controllers/user.controller");

const io = new Server(server, { cors: { origin: "http://localhost:5173" } });

const port = process.env.PORT;

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);

  const userId = socket.handshake.query?.userId;
  const ownerParkingLotId = socket.handshake.query?.ownerParkingLotId;
  if (userId) socket.join(`user:${userId}`);
  if (ownerParkingLotId) socket.join(`owner:${ownerParkingLotId}`);
  socket.join("map");

  //For messaging
  socket.on("join-chat-room", (chatRoomId) => {
    socket.join(`chat:${chatRoomId}`);
  });
  socket.on("new-message", (newMessageReceived, sender) => {
    socket
      .to(`user:${newMessageReceived.receiver}`)
      .emit("message-received", newMessageReceived);
  });

  socket.on("disconnect", () => console.log("disconnected", socket.id));
});
app.set("io", io);

app.get("/api/V1", getUsers);

app.use("/api/V1/auth", authRouter);
app.use("/api/V1/driver", driverRouter);
app.use("/api/V1/parking-lot", parkingRouter);
// mount bookings routes after middleware
app.use("/api/V1/booking", bookingRouter);
app.use("/api/V1/payment", paymentRouter);
app.use("/api/V1/chat", chatRouter);

// start cron worker
startBookingWorker(io);

const startServer = async () => {
  try {
    await connectDB();
    server.listen(port, () => console.log(`Server running on port ${port}`));
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
