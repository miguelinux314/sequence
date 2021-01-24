/**
 * @file game.js
 * @author Miguel Hernández Cabronero <miguel.hernandez@uab.cat>
 * @date 24/01/2021
 * @version 1.0
 * 
 * @brief Logic of the Sequence game
 */

var assert = require('assert');

// Game constants
const main_board_row_count = 8
const main_board_column_count = 11
const suits = ["h", "s", "d", "c"]
const suit_min = 2
const suit_max = 9
const figures_no_joker = ["Q", "K", "A"]
const joker_codes = ["j1", "j2"]
const min_players = 2
const max_players = 3
const cards_in_hand = 6

// An abstract game of sequence, using no GUI or socket communication
class SequenceGame {

    constructor(card_assignment) {
        this.card_assignment = card_assignment
        // Pegs placed indexed by x-y (example ['0-12']), with values being
        // player ids

        // this.pegs_by_xy = {}
    }

    /// Get the cards for all cards to be placed on the boardº1
    static get_board_deck_cards() {
        var code_list = []
        for (var n = 0; n < 2; n++) {
            for (var s = 0; s < suits.length; s++) {
                for (var i = suit_min; i <= suit_max; i++) {
                    code_list.push(suits[s] + i)
                }
                for (var i in figures_no_joker) {
                    code_list.push(suits[s] + figures_no_joker[i])
                }
            }
        }
        console.log("$$$$$")
        console.log(code_list)
        console.log("[watch] code_list.length=" + code_list.length)
        console.log("[watch] main_board_column_count * main_board_row_count=" + main_board_column_count * main_board_row_count)
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

// Game exports
module.exports.SequenceGame = SequenceGame
module.exports.main_board_row_count = main_board_row_count
module.exports.suit_min = suit_min
module.exports.suit_max = suit_max
module.exports.figures_no_joker = figures_no_joker
module.exports.joker_codes = joker_codes
module.exports.main_board_column_count = main_board_column_count
module.exports.min_players = min_players
module.exports.max_players = max_players
module.exports.cards_in_hand = cards_in_hand