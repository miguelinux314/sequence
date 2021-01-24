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
        assert(this.status == STATE_WELCOME || this.status == STATE_HOST_EXPECTING_PLAYERS)
        var host = $("#login_host").prop("value").replace(/\s*/g, "")
        var port = parseInt($("#login_port").prop("value").replace(/[^0-9]*/g, ""))
        var name = $("#name_input").prop("value").trim()
        console.log("[watch] [host, port, name]=" + [host, port, name])
        this.client = new client.Client(host, port, name)
        console.log("[watch] this.client=" + this.client)
    }

    click_welcome_host_button() {
        this.host_form_changed()
        if ($("host_button").prop("disabled") == true) {
            return
        }
        var local_port = parseInt($("#local_port").prop("value").replace(/[^0-9]*/g, ""))
        console.log("[watch] local_port=" + local_port)
        this.server = new server.Server(local_port)
        var _this = this
        this.server.on("players_changed", function () {
            var player_count = _this.server.get_player_count()
            $("#player_count").text(player_count
                + " player" + (player_count == 0 || player_count > 1 ? "s" : "")
                + " connected")
            if (player_count >= game.min_players) {
                $("#start_now").text("Start now")
                $("#start_now").fadeIn()
            }
        })

        this.status = STATE_HOST_EXPECTING_PLAYERS
        $("#login_host").prop("value", "localhost")
        $("#login_host").prop("disabled", true)
        $("#login_port").prop("value", this.server.local_port)
        $("#login_port").prop("disabled", true)

        this.login_form_changed()
        this.host_form_changed()
        $("#hosting_div").fadeIn()
        $("#start_now").hide()
    }

    click_start_now_button() {
        if (this.status != STATE_HOST_EXPECTING_PLAYERS) {
            console.log("Error: unexpected click of start button")
            return
        }
        console.log("starting now...")
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
    }

    /// Populates the main game area with divs.
    add_main_card_slots() {
        var s = "";
        for (var i = 0; i < game.main_board_row_count; i++) {
            for (var j = 0; j < game.main_board_column_count; j++) {
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

module.exports.GUI = GUI