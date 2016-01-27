var Validate = module.exports = (function(){
    var Validate = {}

    var USERNAME_ERROR_MSG = "Username must be made of 1-30 letters, numbers, or underscores."
    var PASSWORD_ERROR_MSG = "Passphrase must be made of at least 8 characters, at least one lower, one uppercase, and one number."

    Validate.isInt = function(value) {
        if (isNaN(value)) {
            return false;
        }
        var x = parseFloat(value);
        return (x | 0) === x;
    }

    Validate.usernamePassword = function(name, pass){
        var error_msg = validateUsername(name)
        if (error_msg) return error_msg

        error_msg = validatePassword(pass)
        if (error_msg) return error_msg

        return null
    }

    function validateUsername(name){
        if (name.match(/^[a-zA-Z0-9_]{1,30}$/)){
            return null
        } else {
            return USERNAME_ERROR_MSG
        }
    }

    function validatePassword(pass){
        if (!pass || pass.length < 8
            || pass.length > 1024
            || pass.search(/[a-z]/) < 0
            || pass.search(/[A-Z]/) < 0
            || pass.search(/[0-9]/) < 0){
            return PASSWORD_ERROR_MSG
        }
        return null
    }

    return Validate
}())
