# 10/12 Pre-midterm crunch

## Bugs

### Major
- Backend doesn't store images at all with persistence, they're temporary and disappear on refresh
	- Cases tested: 
		- Logged in -> image uploaded on Analyze page -> navigate to any new page: assessment/image is not visible on Dashboard, on Analyze page, or Compare
		- Same issue is present if not logged in
		- Full disclosure I don't feel like finding the regression in the backend tonight because this worked in the earlier iteration for the first progress update and I'd prefer to find it by hand
		- Ultimately it's not a huge deal and it could be an issue with my machine, but 100% worth being aware of for presentations
		- If it works on Angie's then we can just use hers to demo
	- If we're careful, we could dodge this for the midterm presentation... demo this last or navigate to pages that don't have images sequentially, we just want to avoid getting called out on this if possible
- Uploading and demoing any image at all on the Compare page visually displays a 404 on the image card
	- We cannot demo image uploads on this page at all
	- These also disappear on switching pages
- List of opthalmologists flickers and disappears on the "Book an appointment" page
	- Sometimes it disappears quickly enough for it to be not noticeable, sometimes it sticks for a few seconds before blanking
	- Looks like it's due to logic around the GET for /api/doctors?
	- Might have to have placeholder data present or seeded for a doctor in the system

### Minor
- No input validation for user-facing input fields aside from ints in height?
	- Should be quick and easy for email fields to at least warn the user "Please enter a valid email" in case we miss a key when typing an email for presentations
	- Didn't check this in super intensive detail and isn't the end of the world if we use autofill, but could be a quick fix to improve quality and save us from a slip-up
- Patient name isn't passed to the hero "Good morning" greeting on the Dashboard, test account created with name of "Full Name" is always addressed as "Patient"
	- Should probably use the patient's registered first name instead of "Patient"
	- If we're extra lazy we could just change that greeting to something like "Welcome back!" or "We're glad to see you again" etc
- When signed in, the home page still states "Create patient account"
	- This should probably be grayed out and disabled if a patient is actively signed in
	- Could be ok in the case of a doctor being signed in (to create an account on the behalf of a user? Seems like that could get scary to implement)
	- Could also get around this by just routing the navbar logo to /dashboard when logged in and just completely avoiding the root homepage
- Patient ID automatically fills to P-10432 when changing pages even if you manually enter a different one- could maybe have to do with the image persistence issue?
	- Either way this one's also worth noting for presentations, we shouldn't change that ID manually in case anyone notices that it always resets to 10432

### Personal input / Post-midterm todos
- Font size in the footer is hard to read at 100% scale
- Important navigation links in the footer should probably be relocated to the navigation bar
	- Add "Patient portal" to navbar as "Dashboard"?
	- It could be cool for "Dashboard" in the header to redirect to /dashboard if the logged-in user is a patient and route to /doctor if the logged-in user is a doctor
- If we're going to dial back the "all-in-one patient-doctor application" approach
- Homepage "See risk sooner" text could use a new, modern font or different style, sorta looks like Times New Roman to me
- Collect everyone's thoughts on what they like and don't like about the midterm iteration to figure out what works and what doesn't
- The homepage radar logo is pretty cool and I do like the warm, yellow-orange color scheme, probably stick with that
- The pun of the "openI" / OpenAI name might not land, maybe move to OpenDR^2 or OpenDR2 if we want to mention that we're building on a previous work which was titled OpenDR
- Update the readme for finals with something nicer, by the time this is pushed I'll probably have gutted the current readme in case we have to show the actual repo for whatever reason
- Check the api logs to see what's going on with backend, looks like uploading and analyzing an image properly posts to /api/predict but visiting the Analyze page doesn't automatically get from /api/predict