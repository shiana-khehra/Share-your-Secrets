import {} from 'dotenv/config';
import express from 'express';
import BodyParser from 'body-parser';
import session from 'express-session';
import passport from 'passport';
import passportLocalMongoose from 'passport-local-mongoose';
import mongoose from 'mongoose';
import GoogleStrategy from 'passport-google-oauth20';
import findOrCreate from 'mongoose-findorcreate';
// import bcrypt from 'bcrypt';
// import encrypt from 'mongoose-encryption';

const app = express();

// const saltRounds = 10;
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(BodyParser.urlencoded({
    extended: true
}));

app.use(session({
  secret: 'Our little secret',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB");

const userSchema = new mongoose.Schema ({
    email: String,
    password: String,
    googleId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
// userSchema.plugin(encrypt, {secret: process.env.SECRET, encryptedFields: ['password'] });

const User = mongoose.model("User", userSchema);

// use static authenticate method of model in LocalStrategy
passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, {
      id: user.id,
      username: user.username,
      picture: user.picture
    });
  });
});

passport.deserializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ email: profile.email, password: profile.password, googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", function(req, res){
    res.render("home");
});

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/secrets", 
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
});

app.get("/login", function(req, res){
    res.render("login");
});

app.get("/register", function(req, res){
    res.render("register");
});

app.get("/secrets", function(req, res){
    User.find({secret: {$ne:null}}, function(err, foundUsers){
        if(err) {
            console.log(err);
        } else {
            res.render("secrets", {usersWithSecrets: foundUsers});
        }
    });
});

app.get("/logout", function(req, res){
    req.logout(function(err){
        if(err) {
            console.log(err);
        } else {
            res.redirect("/");
        }
    });
});

app.get("/submit", function(req, res){
    if(req.isAuthenticated()){
        res.render("submit");
    } else {
        res.redirect("/login");
    }
});

app.post("/submit", function(req, res){
    const submittedSecret = req.body.secret;

    User.findById(req.user.id, function(err, foundUser){
        if(err) {
            console.log(err);
        } else {
            if(foundUser) {
                foundUser.secret = submittedSecret;
                foundUser.save(function(err){
                    if(err) {
                        console.log(err);
                    } else {
                        res.redirect("/secrets");
                    }
                });
            }
        }
    });
});

app.post("/register", function(req, res){
    User.register({username: req.body.username}, req.body.password, function(err, user){
        if(err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function(){
                res.redirect("/secrets");
            });
        }
    });

    // bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
    //     const newUser = new User({
    //         email: req.body.username,
    //         password: hash
    //     });

    //     newUser.save(function(err){
    //         if(err) {
    //             console.log(err);
    //         } else {
    //             res.render("secrets");
    //         }
    //     });
    // });
});

app.post("/login", function(req, res){
    const user = new User ({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function(err){
        if(err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function(){
                res.redirect("/secrets");
            });
        }
    });

    // const username = req.body.username;
    // const password = req.body.password;

    // User.findOne({email: username}, function(err, foundUser){
    //     if(err) {
    //         console.log(err);
    //     } else {
    //         if(foundUser) {
    //             bcrypt.compare(password, foundUser.password, function(err, result) {
    //                 if(result === true) {
    //                     res.render("secrets");
    //                 }
    //             });
    //         }
    //     }
    // });
});

app.listen(3000);