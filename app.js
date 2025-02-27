if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const express = require('express');
const path = require('path');
const app = express();
const mongoose = require('mongoose');
const methodOverride = require('method-override');
const ejsMate = require('ejs-mate');
const ExpressError = require('./utils/ExpressError');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./models/user');

// Routes
const listingRouter = require('./routes/listingsRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const userRouter = require('./routes/userRoutes');

const dbURL = process.env.ATLASDB_URL;

main()
  .then(() => console.log('MongoDB Connected successfully...'))
  .catch((err) => console.log(err));

async function main() {
  await mongoose.connect(dbURL);
}

app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

const store = MongoStore.create({
  mongoUrl: dbURL,
  crypto: {
    secret: process.env.MONGO_SECRET,
  },
  touchAfter: 24 * 3600, // time period in seconds
});

store.on('error', (err) => {
  console.log('Error in Mongo Session Store ', err);
});

const sessionOptions = {
  store,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
};

// Session Configuration
app.use(session(sessionOptions));
app.use(flash());

// Passport Configuration
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

// Passport Serialization and Deserialization
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Flash Middleware
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.currentUser = req.user;
  next();
});

//
// app.get('/demoUser', async (req, res) => {
//   const fakeUser = new User({ email: 'demo@gmail.com', username: 'demo-user' });
//   const registeredUser = await User.register(fakeUser, 'myPassword');

//   res.send(registeredUser);
// });

// Routes
app.use('/listings', listingRouter);
app.use('/listings/:id/reviews', reviewRouter);
app.use('/', userRouter);

//  middleware to catch all routes
app.all('*', (req, res, next) => {
  return next(new ExpressError(404, 'Page Not Found'));
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  let { status = 500, message = 'Something Error Occurred' } = err;

  // res.status(status).send(message);
  res.render('error.ejs', { message });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on: ${PORT}`);
});
