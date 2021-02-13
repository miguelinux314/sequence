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
const joker_place_code = "j1"
const joker_remove_code = "j2"
const joker_codes = [joker_place_code, joker_remove_code]
const min_players = 2
const max_players = 3
const cards_in_hand = 6
const winning_line_corner = 4
const winning_line_no_corner = 5

// An abstract game of sequence, using no GUI or socket communication
class SequenceGame {

    constructor(card_assignment_xy) {
        this.card_assignment_xy = card_assignment_xy
        // Pegs placed indexed by x-y (example ['0-12']), with values being
        // player ids
        this.pegs_by_xy = {}
    }

    /**
     * Return the id of the winning player (part of the winning play must link to position x,y).
     * If not a winning position, null is returned.
     */
    get_winning_peg(x, y) {
        if (!xy_to_coordinates(x, y) in this.pegs_by_xy) {
            return null
        }
        var candidate_id = this.pegs_by_xy[xy_to_coordinates(x, y)]
        // linked north
        var linked_n = 0
        for (var i = x, j = y-1; j >= 0; j--) {
            var cont = false
            if (xy_to_coordinates(i, j) in this.pegs_by_xy) {
                if (this.pegs_by_xy[xy_to_coordinates(i, j)] == candidate_id) {
                    linked_n++
                    cont = true
                }
            }
            if (!cont) {
                break
            }
        }
        // linked south
        var linked_s = 0
        for (var i = x, j = y + 1; j < main_board_row_count; j++) {
            var cont = false
            if (xy_to_coordinates(i, j) in this.pegs_by_xy) {
                if (this.pegs_by_xy[xy_to_coordinates(i, j)] == candidate_id) {
                    linked_s++
                    cont = true
                }
            }
            if (!cont) {
                break
            }
        }
        if (linked_s + linked_n + 1 >= winning_line_no_corner) {
            return candidate_id
        }
        if (linked_s + linked_n + 1 >= winning_line_corner) {
            if ((x == 0 || x == (main_board_column_count - 1))
                && ((y - linked_n == 0) || (y + linked_s == (main_board_row_count - 1)))) {
                return candidate_id
            }
        }


        // linked east
        var linked_e = 0
        for (var i = x + 1, j = y; i < main_board_column_count; i++) {
            var cont = false
            if (xy_to_coordinates(i, j) in this.pegs_by_xy) {
                if (this.pegs_by_xy[xy_to_coordinates(i, j)] == candidate_id) {
                    linked_e++
                    cont = true
                }
            }
            if (!cont) {
                break
            }
        }
        // linked west
        var linked_w = 0
        for (var i=x-1, j=y; i >= 0; i--) {
            var cont = false
            if (xy_to_coordinates(i, j) in this.pegs_by_xy) {
                if (this.pegs_by_xy[xy_to_coordinates(i, j)] == candidate_id) {
                    linked_w++
                    cont = true
                }
            }
            if (!cont) {
                break
            }
        }
        if (linked_e + linked_w + 1 >= winning_line_no_corner) {
            return candidate_id
        }
        if (linked_e + linked_w + 1 >= winning_line_corner) {
            if ((y == 0 || y == (main_board_row_count - 1))
                && ((x - linked_w == 0) || (x + linked_e == (main_board_column_count-1)))) {
                return candidate_id
            }
        }

        // linked nw
        var linked_nw = 0
        for (var i = x - 1, j = y - 1; (i >= 0) && (j >= 0); i--, j--) {
            var cont = false
            if (xy_to_coordinates(i, j) in this.pegs_by_xy) {
                if (this.pegs_by_xy[xy_to_coordinates(i, j)] == candidate_id) {
                    linked_nw++
                    cont = true
                }
            }
            if (!cont) {
                break
            }
        }
        // linked se
        var linked_se = 0
        for (var i = x + 1, j = y + 1; (i < main_board_column_count) && (j < main_board_row_count); i++, j++) {
            var cont = false
            if (xy_to_coordinates(i, j) in this.pegs_by_xy) {
                if (this.pegs_by_xy[xy_to_coordinates(i, j)] == candidate_id) {
                    linked_se++
                    cont = true
                }
            }
            if (!cont) {
                break
            }
        }
        if (linked_nw + linked_se + 1 >= winning_line_no_corner) {
            return candidate_id
        }
        if (linked_nw + linked_se + 1 >= winning_line_corner) {
            if (((x - linked_nw == 0) || (x + linked_se == (main_board_column_count-1)))
                    && ((y - linked_nw == 0) || (y + linked_se == (main_board_row_count-1)))) {
                return candidate_id
            }
        }

        // linked ne
        var linked_ne = 0
        for (var i = x + 1, j = y - 1; (i < main_board_column_count) && (j >= 0); i++, j--) {
            var cont = false
            if (xy_to_coordinates(i, j) in this.pegs_by_xy) {
                if (this.pegs_by_xy[xy_to_coordinates(i, j)] == candidate_id) {
                    linked_ne++
                    cont = true
                }
            }
            if (!cont) {
                break
            }
        }
        // linked sw
        var linked_sw = 0
        for (var i = x - 1, j = y + 1; (i >= 0) && (j < main_board_row_count); i--, j++) {
            var cont = false
            if (xy_to_coordinates(i, j) in this.pegs_by_xy) {
                if (this.pegs_by_xy[xy_to_coordinates(i, j)] == candidate_id) {
                    linked_sw++
                    cont = true
                }
            }
            if (!cont) {
                break
            }
        }
        if (linked_ne + linked_sw + 1 >= winning_line_no_corner) {
            return candidate_id
        }
        if (linked_ne + linked_sw + 1 >= winning_line_corner) {
            if (((x - linked_sw == 0) || (x + linked_ne == (main_board_column_count-1)))
                    && ((y - linked_ne == 0) || (y + linked_sw == (main_board_row_count-1)))) {
                return candidate_id
            }
        }

        return null
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
                coordinates_to_cardcode[xy_to_coordinates(j, i)] = all_card_codes[k % all_card_codes.length]
                k += 1
            }

        }

        return coordinates_to_cardcode
    }

    /// Return the (unshuffled) list of cards to be dealt to players
    static get_deal_deck_cards() {
        var code_list = SequenceGame.get_board_deck_cards()

        for (var i = 0; i < 2; i++) {
            for (var j in joker_codes) {
                code_list.push(joker_codes[j])
                code_list.push(joker_codes[j])
            }
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

const coordinate_delimiter = "_"

function xy_to_coordinates(x, y) {
    return x + coordinate_delimiter + y
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
module.exports.xy_to_coordinates_index = xy_to_coordinates
module.exports.coordinate_delimiter = coordinate_delimiter
module.exports.joker_place_code = joker_place_code
module.exports.joker_remove_code = joker_remove_code