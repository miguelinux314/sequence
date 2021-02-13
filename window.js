/* global $ */

var sequence_gui = require("./gui.js")

// Configuration
const quick_start = false
// END configuration

var gui = new sequence_gui.GUI()

// Run this function after the page has loaded
$(() => {
    gui.start()

    if (quick_start) {
        $("#host_button").click()
        $("#login_button").click()
    }

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
