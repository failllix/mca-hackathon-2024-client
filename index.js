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
  connection.on("message", async function (incomingMessage) {
    let parsedMessage = JSON.parse(incomingMessage.utf8Data);
    // console.log(
    //   "Received new message:\n",
    //   JSON.stringify(parsedMessage, null, 2)
    // );

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
      const projectiles = parsedMessage.entities;

      const player = get_player({ players, playerId });

      const closest_player = get_closest_player({ player, players });

      const degrees = aim_towards_player({ player, target: closest_player });

      const isTargetPotentiallyHit = get_fields_travelled_into_direction({
        startX: player.x,
        startY: player.y,
        direction: player.rotation,
        distance: 100,
      }).some((pos) => pos.x == closest_player.x && pos.y == closest_player.y);

      const fieldsInDanger = get_fields_in_danger({ projectiles });

      if (is_player_is_in_danger({ player, fieldsInDanger })) {
        const move = calculate_dodge({ player, fieldsInDanger });
        message = { ...message, action: move };
      } else {
        if (isTargetPotentiallyHit) {
          message = { ...message, action: "SHOOT" };
        } else {
          message = { ...message, action: "TURN", degrees };
        }
      }

      console.log("Sending message", message);
      await new Promise((resolve) => setTimeout(resolve, 300));
      connection.send(JSON.stringify(message));
    } catch (error) {
      console.log(error);
    }
  });
});

// Connect to lobby
client.connect(address);

const get_random_element = (arr) =>{
  return arr[Math.floor(Math.random() * arr.length)]
}

const get_random_move = () => {
  return get_random_element(["UP", "DOWN", "LEFT", "RIGHT"])
};

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

const get_fields_travelled_into_direction = ({
  startX,
  startY,
  direction,
  distance,
}) => {
  const directional_vector = get_directional_vector_from_degrees(direction);

  const endX = startX + distance * directional_vector.x;
  const endY = startY + distance * directional_vector.y;

  return drawLine(startX, startY, endX, endY, 0.25).map(el => {return {
    x: Math.round(el.x),
    y: Math.round(el.y)
  }});
};

const get_directional_vector_from_degrees = (degrees) => {
  const radians = ((90.0 - degrees) * Math.PI) / 180.0;

  return { x: Math.cos(radians), y: Math.sin(radians) };
};

const is_player_is_in_danger = ({ player, fieldsInDanger }) => {
  return fieldsInDanger.some(
    (hitField) =>
     hitField.x == player.x && hitField.y == player.y
  );
};

const get_fields_in_danger = ({ projectiles }) => {
  return projectiles
    .map((projectile) =>
      get_fields_travelled_into_direction({
        startX: projectile.x,
        startY: projectile.y,
        direction: projectile.direction,
        distance: projectile.travel_distance,
      })
    )
    .flat();
};

const calculate_dodge = ({ player, fieldsInDanger }) => {
  const availableMoves = get_available_moves(player);  
  const movesWherePlayerWontBeHit = availableMoves.filter((move) => {
    return !fieldsInDanger.some(
      (field) => field.x == move.newPosition.x && field.y == move.newPosition.y
    );
  });

  if (movesWherePlayerWontBeHit.length > 0) {
    console.log("Choosing move from: ", movesWherePlayerWontBeHit);
    
    return get_random_element(movesWherePlayerWontBeHit).action
  } else {
    console.log("Choosing random move.");
    return get_random_move();
  }
};

const get_available_moves = (player) => {
  let availableMoves = [];

  if (player.x < 27) {
    availableMoves.push({
      newPosition: { x: player.x + 1, y: player.y },
      action: "RIGHT",
    });
  }
  if (player.x > 2) {
    availableMoves.push({
      newPosition: { x: player.x - 1, y: player.y },
      action: "LEFT",
    });
  }

  if (player.y < 27) {
    availableMoves.push({
      newPosition: { x: player.x, y: player.y + 1 },
      action: "UP",
    });
  }

  if (player.y > 2) {
    availableMoves.push({
      newPosition: { x: player.x, y: player.y - 1 },
      action: "DOWN",
    });
  }

  return availableMoves;
};
