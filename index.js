const { drawLine } = require("fresenham");
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

let firstMessage = true;
let playerId;

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
      "Received new message:\n",
      JSON.stringify(parsedMessage, null, 2)
    );

    if (firstMessage) {
      firstMessage = false;
      playerId = parsedMessage.player_id;

      console.log("Player has id: ", playerId);
      return;
    }

    let message = { tick: parsedMessage.tick };

    try {
      const players = parsedMessage.players.filter(
        (player) => player.health > 0
      );
      const player = get_player({ players, playerId });

      console.log(player);

      const closest_player = get_closest_player({ player, players });

      console.log("closest: ", closest_player);
      const degrees = aim_towards_player({ player, target: closest_player });

      console.log({ x: closest_player.x, y: closest_player.y });

      console.log(get_potential_fields_travelled_by_projectile({ player }));

      const isTargetPotentiallyHit =
        get_potential_fields_travelled_by_projectile({
          player,
        }).some(
          (pos) => pos.x == closest_player.x && pos.y == closest_player.y
        );

      console.log(isTargetPotentiallyHit);

      if (isTargetPotentiallyHit) {
        message = { ...message, action: "SHOOT" };
      } else {
        message = { ...message, action: "TURN", degrees };
      }

      console.log("Sending message", message);
      connection.send(JSON.stringify(message));
    } catch (error) {
      console.log(error);
    }
  });
});

// Connect to lobby
client.connect(address);

const get_player = ({ playerId, players }) => {
  return players.filter((player) => player.id == playerId)[0];
};

const get_closest_player = ({ player, players }) => {
  return players
    .filter((p) => p.id !== player.id)
    .sort((a, b) => {
      return (
        get_distance_to_player(a, player) - get_distance_to_player(b, player)
      );
    })?.[0];
};

const get_distance_to_player = (playerA, playerB) => {
  console.log(playerA);
  console.log(playerB);

  return Math.sqrt(
    Math.pow(playerB.x - playerA.x, 2) + Math.pow(playerB.y - playerA.y, 2)
  );
};

const aim_towards_player = ({ player, target }) => {
  let angle = radians_to_degrees(
    Math.atan2(target.x - player.x, target.y - player.y)
  );
  angle = (angle + 360) % 360;
  return Math.round(angle);
};

const radians_to_degrees = (radians) => {
  return radians * (180 / Math.PI);
};

const get_potential_fields_travelled_by_projectile = ({ player }) => {
  const directional_vector = get_directional_vector_from_degrees(
    player.rotation
  );

  const endX = player.x + 100 * directional_vector.x;
  const endY = player.y + 100 * directional_vector.y;

  return drawLine(player.x, player.y, endX, endY, 1);
};

const get_directional_vector_from_degrees = (degrees) => {
  const radians = ((90.0 - degrees) * Math.PI) / 180.0;

  return { x: Math.cos(radians), y: Math.sin(radians) };
};
