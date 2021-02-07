/**
 * @file client.js
 * @author Miguel Hernández Cabronero <miguel.hernandez@uab.cat>
 * @date 24/01/2021
 *
 * @brief Client for the Sequence game
 */
var net = require('net')
var assert = require('assert');
var EventEmitter = require('events').EventEmitter
var game = require("./game.js")
var server = require("./server.js")
var JsonSocket = require('json-socket')

const STATE_NOT_CONNECTED = 0
const STATE_LOGGING_IN = 1
const STATE_LOGGED_IN = 2
const STATE_PLAYING = 3

/**
 * Emits on:
 *   - hand_updated
 *   - game_ready
 *   - turn_started
 *   - peg_added
 */
class Client extends EventEmitter {

    constructor(host, port, player_name) {
        super()
        this.game = null
        this.host = host
        this.port = port
        this.socket = new JsonSocket(new net.Socket()); //Decorate a standard net.Socket with JsonSocket
        this.socket.connect(this.port, this.host)
        this.player = new server.Player("-1", player_name, this.socket)
        this.status = STATE_NOT_CONNECTED
        // Messages received from the server
        this.on("logged", this.handle_logged_message.bind(this))
        this.on("game_started", this.handle_game_started_message.bind(this))
        this.on("card_dealt", this.handle_card_dealt_message.bind(this))
        this.on("turn_start", this.handle_turn_start_message.bind(this))
        this.on("card_played", this.handle_card_played_message.bind(this))
        this.on("wait", this.handle_wait_message.bind(this))
        this.on("chat", this.handle_chat_message.bind(this))
        this.on("error", this.handle_error_message.bind(this))
        this.on("discarded_card", this.handle_discarded_card_message.bind(this))
        this.on("game_over", this.handle_game_over_message.bind(this))
        var _this = this
        this.socket.on('connect', function () {
            _this.player.socket.on("message", function (message) {
                _this.emit(message["type"], _this, _this.player, message)
            })
            _this.status = STATE_LOGGING_IN
            _this.player.socket.sendMessage({"type": "login", "name": _this.player.name})
        })
    }

    // Play a card on the given (x,y) coordinate of the board, using a card with card_code from this player's hand
    play_card(x, y, card_code, hand_card_index) {
        var peg_placed = (game.xy_to_coordinates_index(x, y) in this.game.pegs_by_xy)
        var hand_card_code = this.player.hand_code_list[hand_card_index]
        if (hand_card_code == game.joker_remove_code) {
            assert(peg_placed)
        } else {
            assert(!peg_placed)
        }

        this.player.hand_code_list.sort()
        var msg = {
            "type": "play_card",
            "x": x, "y": y,
            "hand_card_codes": this.player.hand_code_list,
            "hand_card_index": hand_card_index,
            "hand_card_code": hand_card_code,
            "card_code": this.player.hand_code_list[hand_card_index]}
        this.socket.sendMessage(msg)
        this.player.hand_code_list.splice(parseInt(hand_card_index), 1)
        this.emit("hand_updated", this.player.hand_code_list)
    }

    discard_card(hand_card_id) {
        this.socket.sendMessage({
            "type":"discard_card",
            "hand_index": hand_card_id.replace("hand_", "")
        })
    }

    handle_logged_message(client, player, message) {
        player.name = message["name"]
        player.id = message["id"]
        client.status = STATE_LOGGED_IN
    }

    handle_game_started_message(client, player, message) {
        client.status = STATE_PLAYING
        this.id_sequence = message.id_sequence
        this.emit("game_ready", message)
    }

    handle_card_dealt_message(client, player, message) {
        assert(client.status == STATE_PLAYING)
        player.deal_card(message["card_code"])
        player.hand_code_list.sort()
        this.emit("hand_updated", player.hand_code_list)
    }
    
    handle_turn_start_message(client, player, message) {
        assert(client.status == STATE_PLAYING)
        client.emit("turn_started", message)
    }

    handle_card_played_message(client, player, message) {
        assert(client.status == STATE_PLAYING)
        // var hand_card_code = player.hand_card_index[message.hand_card_index]
        if (message.hand_card_code == game.joker_remove_code) {
            assert((game.xy_to_coordinates_index(message.x, message.y) in client.game.pegs_by_xy))
            delete client.game.pegs_by_xy[game.xy_to_coordinates_index(message.x, message.y)]
            this.emit("peg_deleted", message.x, message.y, message.id)
        } else {
            assert(!(game.xy_to_coordinates_index(message.x, message.y) in client.game.pegs_by_xy))
            client.game.pegs_by_xy[game.xy_to_coordinates_index(message.x, message.y)] = message.id
            this.emit("peg_added", message.x, message.y, message.id)
        }
    }

    handle_wait_message(client, player, message) {
        // Do nothing
    }

    handle_chat_message(client, player, message) {
        // TODO: implement chat
    }

    handle_error_message(client, player, message) {
        // TODO: disconnect and show some message
    }

    handle_discarded_card_message(client, player, message) {
        if (message.id == player.id) {
            var index = player.hand_code_list.indexOf(message.card_code)
            player.hand_code_list.splice(index, 1)
        }
    }

    handle_game_over_message(client, player, message) {
        if (message.winning_id == player.id) {
            client.emit("game_won")
        } else {
            client.emit("game_lost")
        }
    }
}

module.exports.Client = Client