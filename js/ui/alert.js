
const Alert = {
    init($root) {
    },

    presentAlert: function (message, callback) {
        alert(message);
        if (callback) callback();
    },
}

export default Alert;
