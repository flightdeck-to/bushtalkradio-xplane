const path = require('path');
const fs = require('fs');
const ExtPlaneJs = require('extplanejs');
const axios = require('axios').default;

const API_URL = "https://bushtalkradio.com/api/";

var working_dir = path.dirname(process.execPath);

var config;

// Read config.json, if it doesn't exist, throw an error and exit program
try {
    console.log(working_dir + '\config.json');

    const data = fs.readFileSync(path.join(working_dir, 'config.json'), 'utf8')

    config = JSON.parse(data);
} catch (err) {
    console.log('No config.json found, please create a config.json with your BushTalkRadio.com username and password.\r\nExample:\r\n{\"username\": \"your-username-here\", \"password\": \"your-password-here\" }');
    return;
}

// Global variables
var connected;

var logged_in = false;
var token;
var user_id;

var latitude;
var longitude;
var elevation;
var groundspeed;
var true_psi;
var tail_nr;

// Functions

/**
 * Initiate ExtPlane
 */
const ext_plane = new ExtPlaneJs({
    host: '127.0.0.1',
    port: 51000,
    broadcast: true
});

/**
 * Subscribe to the plugin loaded event
 */
ext_plane.on('loaded', function () {

    connected = true;

    console.log('BushTalkRadio X-Plane client running');

    ext_plane.client.interval(3);

    ext_plane.client.subscribe('sim/flightmodel/position/latitude');
    ext_plane.client.subscribe('sim/flightmodel/position/longitude');
    ext_plane.client.subscribe('sim/flightmodel/position/elevation');
    ext_plane.client.subscribe('sim/flightmodel/position/groundspeed');
    ext_plane.client.subscribe('sim/flightmodel/position/true_psi');
    ext_plane.client.subscribe('sim/aircraft/view/acf_tailnum');

    // Handle all data-ref changes
    ext_plane.on('data-ref', function (data_ref, value) {

        switch (data_ref) {
            case 'sim/flightmodel/position/latitude':
                latitude = value;
                break;
            case 'sim/flightmodel/position/longitude':
                longitude = value;
                break;
            case 'sim/flightmodel/position/elevation':
                elevation = value * 3.2808399; // elevation is retrieved in meters, converted here to ft
                break;
            case 'sim/flightmodel/position/groundspeed':
                groundspeed = value * 1.96; // ground speed is retrieved in m/s, converted here to knots.
                break;
            case 'sim/flightmodel/position/true_psi':
                true_psi = value;
                break;
            case 'sim/aircraft/view/acf_tailnum':
                tail_nr = value.trim().split("\x00").join(""); // Tailnumber contains null data which is removed here
                break;

        }
    });


    setInterval(() => {
        send_pos();
    }, 3000);
});


/**
 * Login to BushTalkRadio for user credentials found in config.json
 */
function login() {
    axios.post(API_URL + 'authenticate', config)
        .then(function (response) {
            logged_in = true;
            user_id = response.data.userId;
            token = response.data.id_token;
        })
        .catch(function (error) {
            console.log('Invalid credentials set in config.json')
        });
}

/**
 * Sends current position to BushTalkRadio
 */
function send_pos() {

    if (!logged_in) {
        login();
        return;
    }

    let config = {
        headers: { Authorization: `Bearer ${token}` }
    };

    let data = {
        USER_ID: user_id,
        PLANE_LATITUDE: latitude,
        PLANE_LONGITUDE: longitude,
        PLANE_ALTITUDE: elevation,
        GROUND_VELOCITY: groundspeed,
        MAGNETIC_COMPASS: true_psi,
        SIM_ON_GROUND: false,
        ATC_ID: tail_nr,
        IS_SLEW_ACTIVE: false,
        SIMULATION_RATE: 1,
        PLANE_ALT_ABOVE_GROUND: elevation
    };

    axios.post(API_URL + 'track', data, config)
        .then(function (response) {
        })
        .catch(function (error) {
            console.log('Error sending data');
        });
}