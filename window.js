/* global $ */

var assert = require('assert');

// Default game configuration
main_board_row_count = 6
suits = ["h", "s", "d", "c"]
suit_min = 1
suit_max = 10
figures_no_joker = ["q", "k"]
joker_codes = ["j1", "j2"]
main_board_column_count = 16

// Identify a player and its connection
class Player {
    constructor(socket) {
        // socket with the Player
        this.socket = socket
        // Cards in hand
        this.card_code_list = []
    }
}

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

class SequenceGameServer extends SequenceGame {
    /// Return the (unshuffled) list of cards to be dealt to players
    static get_deal_deck_cards() {
        var code_list = SequenceGame.get_board_deck_cards()
        for (var i = 0; i < 2; i++) {
            code_list.push(joker_codes * 2)
        }
        return code_list
    }
}

/// Class that interacts with the DOM
class GUI {
    constructor(xy_coordinates_to_cardcode) {
        this.add_main_card_slots()
        this.display_board_card_xy_assignment(xy_coordinates_to_cardcode)
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

    /// Assigns a configuration of cards
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

    static get_card_div(id) {
        return "<div id=\"" + id + "\" class=\"card\"><p>def</p></div>";
    }

    static get_card_id_from_xy(x, y) {
        return "card" + x + "-" + y
    }
}

// Run this function after the page has loaded
$(() => {
    // Random for now
    var card_assignment = SequenceGame.get_random_card_assignment_xy()

    // Add cards to the game board
    var gui = new GUI(card_assignment)
    var game = new SequenceGame(card_assignment)
})
