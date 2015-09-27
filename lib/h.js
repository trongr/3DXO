var H = module.exports = (function(){
    var H = {}

    H.log = function(msg, obj1, obj2, obj3, obj4, obj5, obj6){
        var out = new Date() + " " + msg
        if (obj1) out += " " + str(obj1)
        if (obj2) out += " " + str(obj2)
        if (obj3) out += " " + str(obj3)
        if (obj4) out += " " + str(obj4)
        if (obj5) out += " " + str(obj5)
        if (obj6) out += " " + str(obj6)
        console.log(out)
    }

    function str(obj){
        return JSON.stringify(obj, function(k, v){
            // if v === undefined, JSON.stringify won't show them, but
            // it will if v === null, so converting v to null if
            // undefined
            return (v === undefined ? null : v)
        })//, 2)
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
