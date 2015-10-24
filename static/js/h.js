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
        out += " " + (obj1 ? JSON.stringify(obj1, 0, 2) : "-")
        out += " " + (obj2 ? JSON.stringify(obj2, 0, 2) : "-")
        out += " " + (obj3 ? JSON.stringify(obj3, 0, 2) : "-")
        out += " " + (obj4 ? JSON.stringify(obj4, 0, 2) : "-")
        out += " " + (obj5 ? JSON.stringify(obj5, 0, 2) : "-")
        out += " " + (obj6 ? JSON.stringify(obj6, 0, 2) : "-")
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
