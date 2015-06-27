var H = module.exports = (function(){
    var H = {}

    H.log = function(msg, obj){
        if (obj) console.log(new Date().getTime() + " " + msg + " " + JSON.stringify(obj, 0, 2))
        else console.log(new Date().getTime() + " " + msg)
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

    return H
}())