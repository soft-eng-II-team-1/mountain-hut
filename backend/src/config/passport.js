import passport from "passport";
import LocalStrategy from "passport-local";

import UserDAO from '../dao/user.dao.js';

const userDAO = new UserDAO();

passport.use(new LocalStrategy({ usernameField: 'email'}, async (email, password, done) => {
    try {
        const user = await userDAO.getUser(email, password);
        if (!user) {
            return done(null, false, { message: 'Incorrect email or password.' });
        }
        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));

// public object user (user_id, email, role) is stored in the session
passport.serializeUser((user, done) => { done(null, user); });
passport.deserializeUser((user, done) => { done(null, user); });

export default passport;