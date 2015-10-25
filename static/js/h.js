if (typeof module === "undefined"){
    var module = {}
}
var H = module.exports = (function(){
    var H = {}

    H.param = function(req, param){
        return req.params[param] || req.query[param] || req.body[param]
    }

    H.log = function(msg, obj1, obj2, obj3, obj4, obj5, obj6){
        var out = new Date() + " " + msg
        out += " " + (obj1 ? str(obj1) : "-")
        out += " " + (obj2 ? str(obj2) : "-")
        out += " " + (obj3 ? str(obj3) : "-")
        out += " " + (obj4 ? str(obj4) : "-")
        out += " " + (obj5 ? str(obj5) : "-")
        out += " " + (obj6 ? str(obj6) : "-")
        console.log(out)
    }

    function str(obj){
        if (typeof obj === "object"){
            return JSON.stringify(obj, 0, 2)
        } else {
            return obj
        }
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

    H.s2mmss = function(s){
        var t = Math.abs(s)
        var sign, mm, ss;
        sign = (s < 0 ? "-" : "")
        mm = parseInt(t / 60, 10);
        ss = parseInt(t % 60, 10);
        mm = mm < 10 ? "0" + mm : mm;
        ss = ss < 10 ? "0" + ss : ss;
        return sign + mm + ":" + ss
    }

    // rounds x or y or z coordinate to a the zone's lower left coordinate
    H.toZoneCoordinate = function(x, zone_size){
        return Math.floor(x / zone_size) * zone_size
    }

    return H
}())
