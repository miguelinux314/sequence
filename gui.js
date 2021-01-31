/**
 * @file gui.js
 * @author Miguel Hernández Cabronero <miguel.hernandez@uab.cat>
 * @date 24/01/2021
 *
 * @brief GUI for the sequence game
 */

var assert = require("assert")
var game = require("./game.js")
var server = require("./server.js")
var client = require("./client.js")

const STATE_NOT_STARTED = 0
const STATE_WELCOME = 1
const STATE_HOST_EXPECTING_PLAYERS = 2
const STATE_PLAYING = 3
const STATE_FINISHED = 4

/// Class that interacts with the DOM
class GUI {
    constructor() {
        this.status = STATE_NOT_STARTED
        $("#hosting_div").hide()
    }

    start() {
        this.status = STATE_WELCOME

        this.add_main_card_slots()
        this.hide_main_divs()
        this.show_welcome_div()
        this.server = null
        this.game = null

        $("#login_host").on("change keydown paste input", this.login_form_changed.bind(this))
        $("#login_port").on("change keydown paste input", this.login_form_changed.bind(this))
        $("#name_input").on("change keydown paste input", this.login_form_changed.bind(this))
        $("#local_port").on("change keydown paste input", this.host_form_changed.bind(this))
        $("#welcome_subbox form").on("submit", function () {
            return false
        })
        $("#login_button").click(this.click_welcome_login_button.bind(this))
        $("#host_button").click(this.click_welcome_host_button.bind(this))
        $("#start_now").click(this.click_start_now_button.bind(this))

        this.host_form_changed()
        this.login_form_changed()
    }

    click_welcome_login_button() {
        assert(this.client == null)
        assert(this.status == STATE_WELCOME || this.status == STATE_HOST_EXPECTING_PLAYERS)
        var host = $("#login_host").prop("value").replace(/\s*/g, "")
        var port = parseInt($("#login_port").prop("value").replace(/[^0-9]*/g, ""))
        var name = $("#name_input").prop("value").trim()
        this.client = new client.Client(host, port, name)
        this.client.on("game_ready", this.start_game.bind(this))
        this.client.on("hand_updated", this.update_hand.bind(this))
        this.client.on("peg_added", this.add_peg.bind(this))
        $("#login_button").prop("disabled", true)
        $("#name_input").prop("disabled", true)
        $("#login_host").prop("disabled", true)
        $("#login_port").prop("disabled", true)
    }

    click_welcome_host_button() {
        this.host_form_changed()
        if ($("host_button").prop("disabled") == true) {
            return
        }
        var local_port = parseInt($("#local_port").prop("value").replace(/[^0-9]*/g, ""))
        this.server = new server.Server(local_port)
        this.server.on("players_changed", this.handle_players_changed_message.bind(this))

        this.status = STATE_HOST_EXPECTING_PLAYERS
        $("#login_host").prop("value", "localhost")
        $("#login_host").prop("disabled", true)
        $("#login_port").prop("value", this.server.local_port)
        $("#login_port").prop("disabled", true)
        $("#player_count").show()

        this.login_form_changed()
        this.host_form_changed()
        $("#hosting_div").fadeIn()
        $("#start_now").hide()
    }

    click_start_now_button() {
        assert(this.status != STATE_PLAYING && this.status != STATE_FINISHED)
        $("#welcome_box").fadeOut()
        $("#start_now").prop("disabled", true)
        this.server.begin_game()
    }

    start_game(game_started_message) {
        if (this.game == null) {
            this.game = new game.SequenceGame(game_started_message.card_assignment_xy)
        }
        assert(this.game != null)
        assert(this.client != null)
        this.client.game = this.game
        this.display_board_card_xy_assignment(game_started_message.card_assignment_xy)
        this.id_sequence = game_started_message.id_sequence
        for (var i=0; i<this.id_sequence.length; i++) {
            this.id_sequence[i] = parseInt(this.id_sequence[i])
        }
        $("#welcome_box").hide()
        $("#game_div").fadeIn()
        this.status = STATE_PLAYING
        console.log("gui started game")
        console.log("[watch] this.id_sequence=" + this.id_sequence)
        console.log("[watch] this.client.player.id=" + this.client.player.id)
    }

    update_hand(card_list) {
        assert(this.status == STATE_PLAYING)
        var s = ""
        var hand_id_list = []
        for (var i in card_list) {
            var hand_id = "hand_" + i
            hand_id_list.push("#" + hand_id)
            var div_html = GUI.get_card_div_html(hand_id, false)
            s += div_html + "\n"
        }
        $("#card_selection_box").html(s)
        for (var i in hand_id_list) {
            this.display_card(hand_id_list[i], card_list[i])
        }
    }

    add_peg(x, y, id) {
        console.log("Heeeeeey1")
        $("#card" + game.xy_to_coordinates_index(x,y) + " div.peg").addClass("taken")
        console.log("Heeeeeey2")
        console.log("[watch] id=" + id)
        console.log("[watch] this.id_sequence=" + this.id_sequence)
        console.log(this.id_sequence)
        console.log("[watch] this.id_sequence.indexOf(id)=" + this.id_sequence.indexOf(id))
        $("#card" + game.xy_to_coordinates_index(x,y) + " div.peg").addClass("player" + (this.id_sequence.indexOf(id)+1))
        console.log("Heeeeeey3")
    }

    handle_players_changed_message(id_to_player) {
        var player_count = Object.keys(id_to_player).length
        var player_count_str = player_count + " player"
        if (player_count == 0 || player_count > 1) {
            player_count_str += "s"
        }
        $("#player_count").text(player_count_str + " connected")
        if (player_count >= game.min_players) {
            $("#start_now").text("Start now")
            $("#start_now").fadeIn()
        }
        if (player_count == game.max_players && this.server != null) {
            $("#start_now").click()
        }
    }

    host_form_changed() {
        if (this.status == STATE_WELCOME) {
            $("#host_button").text("Host game")
            $("#host_button").prop("enabled", true)

            $("#local_port").contents($("#login_port").prop("value"))
            $("#local_port").addClass("wrong")
            $("#local_port").removeClass("right")
            $("#host_button").prop("disabled", true)
            const port_text = $("#local_port").prop("value").trim().replace(/[^0-9]+/g, "")
            $("#local_port").prop("value", port_text)

            var port = parseInt(port_text)
            if (port_text.match(/^[0-9]+$/g) != null
                && !isNaN(port)
                && !(port < server.min_port || port > server.max_port)) {
                $("#local_port").addClass("right")
                $("#local_port").removeClass("wrong")
                $("#host_button").prop("disabled", false)
            }
        }

        if (this.status != STATE_WELCOME) {
            $("#host_button").text("Hosting game...")
            $("#host_form").children().prop("disabled", true)
        }
    }

    login_form_changed() {
        const box_id_list = ["#login_port", "#login_host", "#name_input"]

        $("#login_port").contents($("#login_port").prop("value"))
        for (var i in box_id_list) {
            $(box_id_list[i]).addClass("wrong")
            $(box_id_list[i]).removeClass("right")
        }
        $("#login_button").prop("disabled", true)

        var name = $("#name_input").prop("value").trim()
        if (name) {
            $("#name_input").removeClass("wrong")
            $("#name_input").addClass("right")
        }

        const port_text = $("#login_port").prop("value").trim().replace(/[^0-9]+/g, "")
        $("#login_port").prop("value", port_text)
        var port = parseInt(port_text)
        if (!isNaN(port)) {
            $("#login_port").removeClass("wrong")
            $("#login_port").addClass("right")
        }

        const host_text = $("#login_host").prop("value").replace(/[^A-Za-z0-9\.]/g, "")
        $("#login_host").prop("value", host_text)
        if (host_text) {
            $("#login_host").removeClass("wrong")
            $("#login_host").addClass("right")
        }

        if (!isNaN(port) && host_text && name && !(port < server.min_port || port > server.max_port)) {
            $("#login_button").prop("disabled", false)
        }

        if (this.client != null) {
            $("#login_button").prop("disabled", true)
        }
    }

    /// Populates the main game area with divs.
    add_main_card_slots() {
        var s = "";
        for (var i = 0; i < game.main_board_row_count; i++) {
            for (var j = 0; j < game.main_board_column_count; j++) {
                s += GUI.get_card_div_html(GUI.get_card_id_from_xy(j, i), true) + "\n"
            }
        }
        $("#game_box").html(s)
    }

    /// Assigns a configuration of cards to the
    display_board_card_xy_assignment(coordinates_to_cardcode) {
        for (var coordinates in coordinates_to_cardcode) {
            var coordinate_list = coordinates.split(game.coordinate_delimiter)
            var x = coordinate_list[0]
            var y = coordinate_list[1]
            var id_string = "#" + GUI.get_card_id_from_xy(x, y)
            var card_code = coordinates_to_cardcode[coordinates]
            this.display_card(id_string, card_code)
        }
    }

    // Display a card div and add the appropriate listeners
    display_card(card_id, card_code) {
        var card_name
        var card_class
        switch (card_code[0]) {
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
            case "j":
                card_name = "J"
                card_class = "joker" + card_code[1]
                break
            default:
                card_name = "[ERROR]"
                card_class = "[ERROR]"
        }

        card_name = "<span class='card_class_text'>" + card_name + "</span>"
        card_name += card_code[1]
        var q = card_id + " p.card_label"
        $(q).html(card_name)
        $(card_id).addClass(card_class)
        var cardcode_class = "cardcode_" + card_code
        $(card_id).addClass(cardcode_class)

        var is_hand_card = ($(card_id).find("div.peg").length == 0)

        // All card get some hover
        $(card_id).hover(function () {
                var same_cardcode
                if (game.joker_codes.includes(card_code)) {
                    same_cardcode = $("div.card")
                } else {
                    same_cardcode = $(".cardcode_" + card_code)
                }
                var highlighted_count = 0

                for (var i = 0; i < same_cardcode.length; i++) {
                    if ($("#" + same_cardcode[i].id).find("div.peg").length > 0) {
                        if ($("#" + same_cardcode[i].id).find("div.peg.taken").length == 0) {
                            $("#" + same_cardcode[i].id).addClass("highlighted_hover")
                            highlighted_count += 1
                        }
                    }
                }

                if (is_hand_card) {
                    if (highlighted_count == 0) {
                        // Hand card: highlight only if more than one card was selectable
                        $(card_id).removeClass("highlighted_hover")
                    } else {
                        $(card_id).addClass("highlighted_hover")
                    }
                } else if ($(card_id).find("div.peg.taken").lenght > 0) {
                    $(card_id).removeClass("highlighted_hover")
                }
            },
            function () {
                $("div.card").removeClass("highlighted_hover")
            })

        if (is_hand_card) {
            // Hand cards become draggable
            $(card_id).draggable({
                start: function () {

                },
                stop: function () {
                    $(card_id).animate({
                        top: "0px",
                        left: "0px"
                    }, 250);
                },
            })
        } else {
            // Board cards become droppable
            $(card_id).droppable({
                drop: function (event, ui) {
                    console.log(event)
                    console.log(ui)
                    var cls = "cardcode_" + card_code
                    console.log("[watch] cls=" + cls)
                    var draggable_is_joker = false
                    for (var i in game.joker_codes) {
                        if (ui.draggable.hasClass(game.joker_codes[i])) {
                            draggable_is_joker = true
                            break
                        }
                    }
                    if ((ui.draggable.hasClass(cls) || draggable_is_joker)
                            && ($(card_id).find("div.peg.taken").length == 0)) {
                        console.log("bingo")
                        var parts = card_id.replace("#card", "").split(game.coordinate_delimiter)
                        var x = parts[0]
                        var y = parts[1]
                        ui.draggable.fadeOut()
                        ui.draggable.remove()
                        this.client.play_card(x, y, card_code)
                        // TODO: block dragging until next me-turn
                    } else {
                        console.log("nope")
                    }
                }.bind(this)
            })
        }
    }

    hide_main_divs() {
        $("#main_container").children().hide()
    }

    show_welcome_div() {
        $("#welcome_box").fadeIn(2000)
    }

    static get_card_div_html(id, show_peg) {
        var s = "<div id='" + id + "' class='card'>" +
            "<div class='card_contents'>" +
            "<p class='card_label'>def</p>";
        if (show_peg) {
            s += "<div class='peg'/>"
        }
        s += "</div></div>";
        return s
    }

    static get_card_id_from_xy(x, y) {
        return "card" + game.xy_to_coordinates_index(x, y)
    }
}

module.exports.GUI = GUI