const WebSocketClient = require("websocket").client;

const client = new WebSocketClient();

// Check that address was passed to process
const baseAddress = process.argv[2];
if (baseAddress === undefined || baseAddress === "") {
  console.error(`Cannot connect to '${baseAddress}'`);
  process.exit(1);
}
const address = baseAddress + "?clientType=PLAYER&username=failllix";
console.log(`Starting client. Connecting to ${address}`);

const availableActions = ["MOVE", "TURN", "SHOOT"];
const moveDirections = ["UP", "DOWN", "LEFT", "RIGHT"];

// Handle connection
client.on("connect", function (connection) {
  console.log("WebSocket Client Connected.");

  // Make connection available in outside scope
  socketConnection = connection;

  connection.on("error", function (error) {
    console.log("Connection Error:", error);
  });

  // Handle close events
  connection.on("close", function (closeEvent) {
    console.log("Connection closed:", closeEvent);
  });

  // Handle incoming messages
  connection.on("message", function (incomingMessage) {
    let parsedMessage = JSON.parse(incomingMessage.utf8Data);
    console.log(
      "Received new game state:\n",
      JSON.stringify(parsedMessage, null, 2)
    );

    const action = availableActions[Math.round(Math.random() * 2)];

    let message = { tick: parsedMessage.tick };

    switch (action) {
      case "TURN":
        const degrees = Math.round(Math.random() * 360);
        message = { ...message, action: "TURN", degrees };
        break;
      case "SHOOT":
        message = { ...message, action: "SHOOT" };
        break;
      case "MOVE":
        const direction = Math.round(Math.random() * 3);
        message = { ...message, action: moveDirections[direction] };
        break;
    }

    console.log("Sending message", message);
    connection.send(JSON.stringify(message));
  });
});

// Connect to lobby
client.connect(address);
