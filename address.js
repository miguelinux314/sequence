/**
 * @file address.js
 * @author Miguel Hernández Cabronero <miguel.hernandez@uab.cat>
 * @date 13/02/2021
 *
 * Tools to retrieve network and ip addresses. From
 * https://gist.github.com/ganapativs/65fbe1c709a8701ec6b84729b3726554
 * and https://github.com/sindresorhus/public-ip
 */

var os = require('os')
var ifaces = os.networkInterfaces();
const publicIp = require('public-ip');

(async () => {module.exports.public_ip = await publicIp.v4()})();

/**
 * Return the IPv4 of the local adapter, typically corresponding to the local network.
 * It returns "localhost" if the ip cannot be found.
 */
function get_network_ip() {
    var address = "localhost"
    for (var dev in ifaces) {
        var dev = ifaces[dev]
        for (var i in dev) {
            var iface = dev[i]
            if (!iface.internal && iface.family == "IPv4") {
                return iface.address
            }
        }
    }
    return address
}

function get_public_ip() {
    return publicIp.v4()
}

module.exports.get_public_ip = get_public_ip
module.exports.get_private_ip = get_network_ip