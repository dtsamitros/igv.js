// TODO -- eliminate dependence on getBrowser
// import {getBrowser} from "../igv-create.js";

const Alert = {
    presentAlert: function (message) {
        alert(message);
        // getBrowser().presentAlert(message);
    },

// TODO -- eliminate dependence on getBrowser
    presentMessageWithCallback: function (message, fn) {
        alert(message); fn();
        // getBrowser().presentMessageWithCallback(message, fn);
    }
}

export default Alert;
