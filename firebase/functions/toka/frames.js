var firebase = require('firebase-admin');

module.exports = {
    "mint":  function(req) {
        const frame = {};
        frame.id = "mint";
        frame.square = true;
        frame.postUrl = `https://toka.lol/collect/base:${req.params.address}`;
        frame.imageText = "TBD";
        frame.buttons = [
            {
                "label": "Next",
                "action": "post",
            }
        ];
        return frame;
    }
};