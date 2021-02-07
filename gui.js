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
var htmlSanitize = require('sanitize-html')

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
        this.client.on("game_ready", this.handle_game_ready_event.bind(this))
        this.client.on("hand_updated", this.message_hand_updated_event.bind(this))
        this.client.on("peg_added", this.handle_peg_added_event.bind(this))
        this.client.on("peg_deleted", this.handle_deleted_peg_event.bind(this))
        this.client.on("turn_started", this.handle_turn_started_event.bind(this))
        this.client.on("game_won", this.handle_game_won_event.bind(this))
        this.client.on("game_lost", this.handle_game_lost_event.bind(this))
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
        this.server.start_game()
    }

    handle_game_ready_event(game_started_message) {
        if (this.game == null) {
            this.game = new game.SequenceGame(game_started_message.card_assignment_xy)
        }
        assert(this.game != null)
        assert(this.client != null)
        this.client.game = this.game
        this.display_board_card_xy_assignment(game_started_message.card_assignment_xy)
        this.id_sequence = game_started_message.id_sequence
        this.id_to_name = game_started_message.id_to_name
        $("div.player_box").hide()
        for (var i in this.id_sequence) {
            this.id_sequence[i] = parseInt(this.id_sequence[i])
            var player_box = $("div.player_box.player" + (this.id_sequence.indexOf(this.id_sequence[i]) + 1))
            player_box.fadeIn()
            player_box.find("p.player_name").html(htmlSanitize(this.id_to_name[this.id_sequence[i]]))
            if (this.id_sequence[i] == this.client.player.id) {
                player_box.find("p.player_number").html("You")
            } else {
                player_box.find("p.player_number").html("Player " + (parseInt(i) + 1))
            }
        }
        $("#welcome_box").hide()
        $("#game_div").fadeIn()
        this.status = STATE_PLAYING
        $("#card_selection_box").addClass("player" + (this.id_sequence.indexOf(this.client.player.id) + 1))
        $("#trash").droppable({
            drop: function (event, ui) {
                this.client.discard_card(ui.draggable[0].id)
                ui.draggable.fadeOut()
            }.bind(this)
        })
    }

    message_hand_updated_event(card_list) {
        assert(this.status == STATE_PLAYING)
        var s = ""
        var hand_id_list = []
        card_list = card_list.sort()
        for (var i in card_list) {
            var hand_id = "hand_" + i
            hand_id_list.push("#" + hand_id)
            var div_html = GUI.get_card_div_html(hand_id, false)
            s += div_html + "\n"
        }
        $("#card_selection_box").html("")
        $("#card_selection_box").html(s)
        for (var i in hand_id_list) {
            this.display_card(hand_id_list[i], card_list[i])
        }
    }

    handle_peg_added_event(x, y, id) {
        $("#card" + game.xy_to_coordinates_index(x, y)).addClass("taken")
        $("#card" + game.xy_to_coordinates_index(x, y) + " div.peg").addClass("taken")
        $("#card" + game.xy_to_coordinates_index(x, y) + " div.peg").addClass("player" + (this.id_sequence.indexOf(id) + 1))
    }

    handle_deleted_peg_event(x, y, id) {
        $("#card" + game.xy_to_coordinates_index(x, y)).removeClass("taken")
        $("#card" + game.xy_to_coordinates_index(x, y) + " div.peg").removeClass("taken")
        for (var i = 0; i < game.max_players; i++) {
            $("#card" + game.xy_to_coordinates_index(x, y) + " div.peg").removeClass("player" + i)
        }
    }

    handle_turn_started_event(message) {
        $("#game_div .active").removeClass("active")
        $("div.player_box.player" + (this.id_sequence.indexOf(message.id) + 1)).addClass("active")
        $("[id^=hand_]").draggable("disable")
        if (message.id == this.client.player.id) {
            $("#card_selection_box").addClass("active")
            $("[id^=hand_]").draggable("enable")
        }
    }

    handle_game_won_event() {
        $("#game_over").removeClass("lost")
        $("#game_over").addClass("won")
        $("#game_over").fadeIn()
        $("#game_over .message").html("You WON!!")
    }

    handle_game_lost_event() {
        $("#game_over").removeClass("won")
        $("#game_over").addClass("lost")
        $("#game_over").fadeIn()
        $("#game_over .message").html("You lost...")
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

        card_name += card_code[1]
        var card_title = card_code
        if (card_name == "J1") {
            card_name = "☆"
            $(card_id).attr("title", "Can be placed in any empty board cell.")
        } else if (card_name == "J2") {
            card_name = "☇"
            $(card_id).attr("title", "Can remove any peg on the board.")
        }

        var q = card_id + " p.card_label"
        $(q).html(card_name)
        $(card_id).addClass(card_class)
        var cardcode_class = "cardcode_" + card_code
        $(card_id).addClass(cardcode_class)
        var is_hand_card = ($(card_id).find("div.peg").length == 0)

        // All cards get some hover
        $(card_id).hover(function () {
                var same_cardcode
                if (card_code == game.joker_place_code) {
                    same_cardcode = $(".card:not(.taken)")
                } else if (card_code == game.joker_remove_code) {
                    same_cardcode = $(".card.taken")
                } else {
                    same_cardcode = $(".cardcode_" + card_code + ":not(.taken)")
                }
                var highlighted_count = 0

                for (var i = 0; i < same_cardcode.length; i++) {
                    $("#" + same_cardcode[i].id).addClass("highlighted_hover")
                    highlighted_count += 1
                }

                $("[id^=hand_]").removeClass("highlighted_hover")
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
            // Hand cards get the draggable listener, although it starts disabled
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
            $(card_id).draggable("disable")
        } else {
            // Board cards become droppable
            $(card_id).droppable({
                drop: function (event, ui) {
                    var cls = "cardcode_" + card_code
                    var play_card = false
                    if ((ui.draggable.hasClass("cardcode_" + game.joker_remove_code))
                        && ($(card_id).find("div.peg.taken").length == 1)) {
                        // TODO: remove everywhere, notify
                        play_card = true
                    } else if (($(card_id).find("div.peg.taken").length == 0)
                        && (ui.draggable.hasClass(cls)
                            || ui.draggable.hasClass("cardcode_" + game.joker_place_code))) {
                        play_card = true
                    }
                    if (play_card) {
                        var parts = card_id.replace("#card", "").split(game.coordinate_delimiter)
                        var x = parts[0]
                        var y = parts[1]
                        ui.draggable.fadeOut()
                        this.client.play_card(x, y, card_code, ui.draggable[0].id.replace("hand_", ""))
                    }
                }.bind(this).bind(card_code)
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