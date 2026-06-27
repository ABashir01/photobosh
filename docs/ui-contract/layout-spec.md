# Layout Spec

## Step 1: Create Room

- Vertical order:
  1. small masthead
  2. large headline block
  3. one form field
  4. one primary action

Failure conditions:

- More than one primary action visible
- Background/theme controls shown here

## Step 2: Waiting Lobby

- Vertical order:
  1. masthead with room id
  2. live booth preview
  3. invite block
  4. participant readiness block
  5. shared background rail
  6. action bar

Failure conditions:

- Theme selection shown before capture
- Booth preview visually smaller than the control stack

## Step 3: Capture

- Booth occupies nearly all of the viewport.
- Countdown overlay is centered and dominant.
- All metadata and setup controls are hidden.

Failure conditions:

- Small inset video
- visible room-management controls

## Step 4: Theme Selection

- Vertical order:
  1. masthead
  2. heading
  3. large strip preview
  4. horizontal theme rail
  5. download action

Failure conditions:

- finalize button present
- print button present
- strip preview visually subordinate to theme controls
