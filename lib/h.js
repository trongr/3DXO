var H = module.exports = (function(){
    var H = {}

    H.log = function(msg, obj1, obj2, obj3){
        var out = new Date() + " " + msg
        if (obj1) out += " " + JSON.stringify(obj1, 0, 2)
        if (obj2) out += " " + JSON.stringify(obj2, 0, 2)
        if (obj3) out += " " + JSON.stringify(obj3, 0, 2)
        console.log(out)
    }

    H.swapObjKeyValues = function(obj){
        var new_obj = {};
        for (var prop in obj) {
            if(obj.hasOwnProperty(prop)) {
                new_obj[obj[prop]] = prop;
            }
        }
        return new_obj;
    }

    H.length = function(obj) {
        var size = 0, key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) size++;
        }
        return size;
    };

    H.param = function(req, param){
        return req.params[param] || req.query[param] || req.body[param]
    }

    return H
}())
