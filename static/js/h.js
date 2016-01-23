if (typeof module === "undefined"){
    var module = {}
}
var H = module.exports = (function(){
    var H = {}

    H.param = function(req, param){
        return req.params[param] || req.query[param] || req.body[param]
    }

    H.log = function(msg, obj1, obj2, obj3, obj4, obj5, obj6){
        var out = new Date().toISOString() + " " + msg
        out += " " + (obj1 != null ? str(obj1) : "-")
        out += " " + (obj2 != null ? str(obj2) : "-")
        out += " " + (obj3 != null ? str(obj3) : "-")
        out += " " + (obj4 != null ? str(obj4) : "-")
        out += " " + (obj5 != null ? str(obj5) : "-")
        out += " " + (obj6 != null ? str(obj6) : "-")
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

    H.shortTimeBrackets = function(){
        return "[" + new Date().toLocaleTimeString().replace(/ AM| PM/, "") + "]"
    }

    H.shortTime = function(){
        return new Date().toLocaleTimeString()
    }

    // color looks like [0.12, 0.23, 0.34], representing RGB from 0 to
    // 1, as opposed to 0 to 255
    H.RGBFractionToHexString = function(color){
        if (!color) return ""
        var r = "00" + (color[0] * 255).toString(16);
        var g = "00" + (color[1] * 255).toString(16);
        var b = "00" + (color[2] * 255).toString(16);
        r = r.substr(r.length - 2)
        g = g.substr(g.length - 2)
        b = b.substr(b.length - 2)
        return r + g + b
    }

    return H
}())
