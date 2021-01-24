/**
 * @file gui.js
 * @author Miguel Hernández Cabronero <miguel.hernandez@uab.cat>
 * @date 24/01/2021
 *
 * @brief GUI for the sequence game
 */

var sequence_game = require("./game.js")
var server = require("./server.js")

/// Class that interacts with the DOM
class GUI {
    start() {
        this.add_main_card_slots()
        this.hide_main_divs()
        this.show_welcome_div()
        this.server = null

        $("#local_port").on("change keydown paste input", this.local_port_value_changed.bind(this))
        $("#login_port").on("change keydown paste input", this.login_port_value_changed.bind(this))
        $("#welcome_subbox form").on("submit", function () {
            return false
        })
        $("#login_button").click(this.click_welcome_login_button.bind(this))
        $("#host_button").click(this.click_welcome_host_button.bind(this))

        this.local_port_value_changed()
        this.login_port_value_changed()
    }

    click_welcome_login_button() {
        console.log("welcome login button clicked")
    }

    click_welcome_host_button() {
        this.local_port_value_changed()
        if ($("host_button").prop("disabled") == "true") {
            return
        }
        console.log("[GUI] Hosting game...")
        this.server = new Server()
    }

    local_port_value_changed() {
        $("#local_port").contents($("#login_port").prop("value"))
        $("#local_port").addClass("wrong")
        $("#local_port").removeClass("right")
        $("#host_button").prop("disabled", true)
        const port_text = $("#local_port").prop("value").trim().replace(/[^0-9]+/g,"")
        $("#local_port").prop("value", port_text)

        var port = parseInt(port_text)
        console.log("'" + port_text + "'")
        console.log(port_text.match(/^[0-9]+$/g))
        if (port_text.match(/^[0-9]+$/g) != null
                && !isNaN(port)
                && !(port < server.min_port || port > server.max_port)) {
            $("#local_port").addClass("right")
            $("#local_port").removeClass("wrong")
            $("#host_button").prop("disabled", false)
        }
    }

    login_port_value_changed() {
        $("#login_port").contents($("#login_port").prop("value"))
        $("#login_port").addClass("wrong")
        $("#login_port").removeClass("right")
        $("#login_button").prop("disabled", true)
        const port_text = $("#login_port").prop("value").trim().replace(/[^0-9]+/g,"")
        $("#login_port").prop("value", port_text)

        var port = parseInt(port_text)
        if (!isNaN(port) && !(port < server.min_port || port > server.max_port)) {
            $("#login_port").removeClass("wrong")
            $("#login_port").addClass("right")
            $("#login_button").prop("disabled", false)
        }
    }

    /// Populates the main game area with divs.
    add_main_card_slots() {
        var s = "";
        for (var i = 0; i < sequence_game.main_board_row_count; i++) {
            for (var j = 0; j < sequence_game.main_board_column_count; j++) {
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