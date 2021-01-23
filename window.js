/* global $ */

var net = require('net')
var JsonSocket = require('json-socket')
var assert = require('assert');
var htmlSanitize = require('sanitize-html')

// Default game configuration
var local_port = 9999
// Game constants
const main_board_row_count = 6
const suits = ["h", "s", "d", "c"]
const suit_min = 1
const suit_max = 10
const figures_no_joker = ["q", "k"]
const joker_codes = ["j1", "j2"]
const main_board_column_count = 16
const min_players = 2
const max_players = 3

// An abstract game of sequence, using no GUI or socket communication
class SequenceGame {

    constructor(card_assignment) {
        this.card_assignment = card_assignment
        // Pegs placed indexed by x-y (example ['0-12']), with values being
        // player ids
        this.pegs_by_xy = {}
    }

    /// Get the cards for all cards to be placed on the boardº1
    static get_board_deck_cards() {
        var code_list = []
        for (var n = 0; n < 2; n++) {
            for (var s = 0; s < suits.length; s++) {
                for (var i = suit_min; i <= suit_max; i++) {
                    code_list.push(suits[s] + i)
                }
                for (var fig in figures_no_joker) {
                    code_list.push(suits[s] + fig)
                }
            }
        }
        assert(code_list.length == main_board_column_count * main_board_row_count)
        return code_list
    }

    /// Return a random configuration of cards, as a dictionary indexed by x-y
    static get_random_card_assignment_xy() {
        // Two full decks,
        var board_deck = SequenceGame.get_board_deck_cards()
        var all_card_codes = SequenceGame.shuffle(board_deck)

        var coordinates_to_cardcode = {}
        var k = 0
        for (var i = 0; i < main_board_row_count; i++) {
            for (var j = 0; j < main_board_column_count; j++) {
                coordinates_to_cardcode[j + "," + i] = all_card_codes[k % all_card_codes.length]
                k += 1
            }

        }

        return coordinates_to_cardcode
    }

    /// Return the (unshuffled) list of cards to be dealt to players
    static get_deal_deck_cards() {
        var code_list = SequenceGame.get_board_deck_cards()
        for (var i = 0; i < 2; i++) {
            code_list.push(joker_codes * 2)
        }
        return code_list
    }

    /**
     * Shuffle an array and return it.
     * From https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
     */
    static shuffle(array) {
        var currentIndex = array.length, temporaryValue, randomIndex;
        // While there remain elements to shuffle...
        while (0 !== currentIndex) {
            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;

            // And swap it with the current element.
            temporaryValue = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temporaryValue;
        }
        return array;
    }
}

/// Class that interacts with the DOM
class GUI {
    constructor() {
        this.add_main_card_slots()
        this.hide_main_divs()
        this.show_welcome_div()
    }

    /// Populates the main game area with divs.
    add_main_card_slots() {
        var s = "";
        for (var i = 0; i < main_board_row_count; i++) {
            for (var j = 0; j < main_board_column_count; j++) {
                s += GUI.get_card_div(GUI.get_card_id_from_xy(j, i)) + "\n"
            }
        }
        $("#game_box").html(s)
    }

    /// Assigns a configuration of cards to the
    display_board_card_xy_assignment(coordinates_to_cardcode) {
        for (var coordinates in coordinates_to_cardcode) {
            coordinates = coordinates.split(",")
            var x = coordinates[0]
            var y = coordinates[1]
            var id_string = "#" + GUI.get_card_id_from_xy(x, y)
            var card_name
            var card_class
            switch (coordinates_to_cardcode[coordinates][0]) {
                case "h":
                    card_name = "&hearts;"
                    card_class = "hearts"
                    break
                case "s":
                    card_name = "&spades;"
                    card_class = "spades"
                    break
                case "d":
                    card_name = "&diams;"
                    card_class = "diamonds"
                    break
                case "c":
                    card_name = "&clubs;"
                    card_class = "clubs"
                    break
                default:
                    card_name = "[ERROR]"
                    card_class = "[ERROR]"
            }
            card_name += coordinates_to_cardcode[coordinates][1]
            $(id_string + ">p").html(card_name)
            $(id_string + ">p").addClass(card_class)
        }
    }

    hide_main_divs() {
        $("#main_container").children().hide()
    }

    show_welcome_div() {
        $("#welcome_box").fadeIn(2000)
    }

    static get_card_div(id) {
        return "<div id=\"" + id + "\" class=\"card\"><p>def</p></div>";
    }

    static get_card_id_from_xy(x, y) {
        return "card" + x + "-" + y
    }
}

// Identify a player and its connection
class Player {
    constructor(id, name, json_socket) {
        // Id string
        this.id = id
        // Custom name
        this.name = name
        // JsonSocket with the Player
        this.socket = json_socket
        // Cards in hand
        this.card_code_list = []
    }
}

const SERVER_STATE_ACCEPTING_CONNECTIONS = 0
const SERVER_STATE_PLAYING = 1
const SERVER_STATE_FINISHED = 2


class Server extends SequenceGame {
    constructor(port) {
        super(SequenceGame.get_random_card_assignment_xy())

        this.port = port
        this.id_to_player = {} // Dictionary of active players
        this.status = SERVER_STATE_ACCEPTING_CONNECTIONS
        this.next_connection_id = 0

        this.deck = SequenceGame.shuffle(SequenceGame.get_deal_deck_cards())
        this.dealt_cards = 0

        this.server = net.createServer();
        this.start()
    }

    // Starts the server for a game
    start() {
        var _this = this
        _this.server.on("connection", function (socket) {
            var new_socket = new JsonSocket(socket)
            _this.next_connection_id += 1
            var id = _this.next_connection_id
            new_socket.on("message", function (message) {
                Server.handle_player_message(_this, new_socket, message, id)
            })
        })
        _this.server.listen(_this.port);
    }

    static handle_player_message(server, socket, message, connection_id) {
        console.log("server received message of type=" + message["type"] + " from " + connection_id)
        console.log(message)
        switch (message["type"]) {
            case "login":
                this.process_login_message(server, message, connection_id, socket)
                break
            case "request_start":
                this.process_request_start_message(server, socket);
                break
            case "bye":
                break
            case "error":
                // TODO Player exited. Clean and resshufle?
                break
            case "chat":
                // TODO: implement chat forwarding
                break
        }
    }

    static process_request_start_message(server, socket) {
        console.log("[Server] Processing request start message")
        if (server.status == SERVER_STATE_ACCEPTING_CONNECTIONS) {
            if (Object.keys(server.id_to_player).length >= min_players) {
                server.begin_game()
            } else {
                socket.sendMessage({
                    "type": "wait", "reason": "Not enough players"
                })
            }
        } else {
            console.log("[Server]: current status: " + server.status)
            Server.send_error_message(socket, "game previously started")
        }
    }

    /// Process a message of type "login"
    static process_login_message(server, message, connection_id, socket) {
        if (server.status == SERVER_STATE_ACCEPTING_CONNECTIONS) {
            var requested_name = message["name"]
            if (requested_name.length == 0) {
                requested_name = "Player #" + connection_id
            }
            var new_player = new Player(
                connection_id, htmlSanitize(requested_name), socket)

            server.id_to_player[new_player.id] = new_player
            new_player.socket.sendMessage(
                {
                    "type": "logged", "id": new_player.id,
                    "name": new_player.name,
                })
            var len = Object.keys(server.id_to_player).length
            console.log("Server added player " + new_player.id + "length=" + len)
            if (len == max_players) {
                // Automatically start game when max count players are reached
                server.begin_game()
            }
        } else {
            Server.send_error_message(socket, "server not accepting connections")
        }
        // TODO: call start if max players achieved
    }

    begin_game() {
        assert(server.status == SERVER_STATE_ACCEPTING_CONNECTIONS
             && Object.keys(this.id_to_player).length >= min_players)
        console.log("[Server] beginning game")
        this.game = new SequenceGame(this.card_assignment)
        for (var id in this.id_to_player) {
            this.id_to_player[id].socket.sendMessage({
                "type": "game_started",
                "id_to_name": this.get_id_to_name()
            })
        }
        this.status = SERVER_STATE_PLAYING
    }

    /// Return a dictionary indexed by player id and entries being names
    get_id_to_name() {
        var id_to_name = {}
        for (var id in this.id_to_player) {
            id_to_name[id] = this.id_to_player[id].name
        }
        return id_to_name
    }


    static send_error_message(socket, message_string) {
        socket.sendMessage({"type": "error", "msg": "ERROR: " + message_string})
    }
}

const CLIENT_STATE_NOT_CONNECTED = 0
const CLIENT_STATE_LOGGING_IN = 1
const CLIENT_STATE_LOGGED_IN = 2
const CLIENT_STATE_PLAYING = 3

class Client extends SequenceGame {

    constructor(host, port, player_name) {
        super(null)
        this.host = host
        this.port = port
        this.socket = new JsonSocket(new net.Socket()); //Decorate a standard net.Socket with JsonSocket
        this.socket.connect(this.port, this.host)
        this.player = new Player("-1", player_name, this.socket)
        this.status = CLIENT_STATE_NOT_CONNECTED
        var _this = this
        this.socket.on('connect', function () {
            _this.player.socket.on("message", function (message) {
                console.log(message)
                Client.handle_message(_this, _this.player, message)
            })
            _this.status = CLIENT_STATE_LOGGING_IN
            _this.player.socket.sendMessage({"type": "login", "name": _this.player.name})
        })
    }

    /// Request game start to the sever
    request_game_start() {
        this.socket.sendMessage({"type": "request_start"})
    }

    static handle_message(client, player, message) {
        switch (message["type"]) {
            case "logged":
                player.name = message["name"]
                player.id = message["id"]
                client.status = CLIENT_STATE_LOGGED_IN
                break

            case "game_started":
                console.log("Client detected game start!")
                console.log(message)
                break

            case "wait":
                console.log("Client " + player.name + "told to wait")
                break

            case "chat":
                // TODO: implement chat
                break

            case "error":
                // TODO: disconnect and show some message
                break


        }
        console.log("client received message of type=" + message["type"])
        console.log("client status afterwards: " + client.status)
        console.log("client's player: " + client.player.name + " #" + client.player.id)
    }
}

// Run this function after the page has loaded
$(() => {
    var gui = new GUI()

    // // Random cards for now
    // var card_assignment = SequenceGame.get_random_card_assignment_xy()
    //
    // // // Add cards to the game board.
    // // gui.display_board_card_xy_assignment(card_assignment)
    // // var game = new SequenceGame(card_assignment)
    //
    // server = new Server(local_port)
    // client_list = []
    // for (var i = 0; i < 3; i++) {
    //     var client = new Client("localhost", local_port, "")
    //     client_list.push(client)
    // }

    // for (var client in client_list) {
    //     client.request_game_start()
    // }

})
