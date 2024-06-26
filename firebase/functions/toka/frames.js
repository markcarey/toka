var firebase = require('firebase-admin');

var util = require(__base + 'toka/util');

module.exports = {
    "mint":  function(req, state) {
        const frame = {};
        frame.id = "mint";
        frame.square = true;
        frame.postUrl = `https://toka.lol/collect/base:${req.params.address}`;
        //frame.imageText = "TBD";
        frame.image = `https://toka.lol/api/contract/images/base/${req.params.address}`;
        frame.buttons = [
            {
                "label": "Mint",
                "action": "post",
            }
        ];
        var tokenId = 1;
        if (req.params.tokenId) {
            tokenId = req.params.tokenId;
        }
        frame.postUrl += `/${tokenId}`;
        frame.image += `/${tokenId}`;
        if (req.params.extra) {
            frame.postUrl += `/${req.params.extra}`;
        }
        return frame;
    },

    "admin":  function(req, state) {
        const frame = {};
        frame.id = "admin";
        frame.square = true;
        frame.postUrl = `https://toka.lol/admin/base:${req.params.address}`;
        //frame.imageText = "TBD";
        frame.image = `https://toka.lol/api/contract/images/base/${req.params.address}`;
        frame.buttons = [
            {
                "label": "Admin",
                "action": "post",
            }
        ];
        var tokenId = 1;
        if (req.params.tokenId) {
            tokenId = req.params.tokenId;
        }
        frame.postUrl += `/${tokenId}`;
        frame.image += `/${tokenId}`;
        if (req.params.extra) {
            frame.postUrl += `/${req.params.extra}`;
        }
        return frame;
    }
};