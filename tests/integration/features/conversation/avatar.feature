Feature: avatar

  Background:
    Given user "owner" exists
    Given user "moderator" exists
    Given user "invited user" exists
    Given user "not invited but joined user" exists
    Given user "not joined user" exists

  Scenario: participants can not set avatar in one-to-one room
    Given user "owner" creates room "one-to-one room"
      | roomType | 1 |
      | invite   | moderator |
    When user "owner" sets avatar for room "one-to-one room" from file "data/green-square-256.png" with 403
    And user "moderator" sets avatar for room "one-to-one room" from file "data/green-square-256.png" with 403
    And user "not invited user" sets avatar for room "one-to-one room" from file "data/green-square-256.png" with 404
    And user "guest" sets avatar for room "one-to-one room" from file "data/green-square-256.png" with 404
    Then user "owner" gets avatar for room "one-to-one room"
    And last avatar is a default avatar of size "128"
    And user "moderator" gets avatar for room "one-to-one room"
    And last avatar is a default avatar of size "128"



  Scenario: owner can set avatar in group room
    Given user "owner" creates room "group room"
      | roomType | 2 |
      | roomName | room |
    And user "owner" adds "moderator" to room "group room" with 200
    And user "owner" promotes "moderator" in room "group room" with 200
    And user "owner" adds "invited user" to room "group room" with 200
    When user "owner" sets avatar for room "group room" from file "data/green-square-256.png"
    Then user "owner" gets avatar for room "group room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "moderator" gets avatar for room "group room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "invited user" gets avatar for room "group room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"

  Scenario: moderator can set avatar in group room
    Given user "owner" creates room "group room"
      | roomType | 2 |
      | roomName | room |
    And user "owner" adds "moderator" to room "group room" with 200
    And user "owner" promotes "moderator" in room "group room" with 200
    And user "owner" adds "invited user" to room "group room" with 200
    When user "moderator" sets avatar for room "group room" from file "data/green-square-256.png"
    Then user "owner" gets avatar for room "group room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "moderator" gets avatar for room "group room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "invited user" gets avatar for room "group room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"

  Scenario: others can not set avatar in group room
    Given user "owner" creates room "group room"
      | roomType | 2 |
      | roomName | room |
    And user "owner" adds "moderator" to room "group room" with 200
    And user "owner" promotes "moderator" in room "group room" with 200
    And user "owner" adds "invited user" to room "group room" with 200
    When user "invited user" sets avatar for room "group room" from file "data/green-square-256.png" with 403
    And user "not invited user" sets avatar for room "group room" from file "data/green-square-256.png" with 404
    # Guest user names in tests must being with "guest"
    And user "guest not joined" sets avatar for room "group room" from file "data/green-square-256.png" with 404
    Then user "owner" gets avatar for room "group room"
    And last avatar is a default avatar of size "128"
    And user "moderator" gets avatar for room "group room"
    And last avatar is a default avatar of size "128"
    And user "invited user" gets avatar for room "group room"
    And last avatar is a default avatar of size "128"



  Scenario: owner can set avatar in public room
    Given user "owner" creates room "public room"
      | roomType | 3 |
      | roomName | room |
    And user "owner" adds "moderator" to room "public room" with 200
    And user "owner" promotes "moderator" in room "public room" with 200
    And user "owner" adds "invited user" to room "public room" with 200
    And user "not invited but joined user" joins room "public room" with 200
    And user "guest moderator" joins room "public room" with 200
    And user "owner" promotes "guest moderator" in room "public room" with 200
    And user "guest" joins room "public room" with 200
    When user "owner" sets avatar for room "public room" from file "data/green-square-256.png"
    Then user "owner" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "moderator" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "invited user" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "not invited but joined user" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "guest moderator" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "guest" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"

  Scenario: moderator can set avatar in public room
    Given user "owner" creates room "public room"
      | roomType | 3 |
      | roomName | room |
    And user "owner" adds "moderator" to room "public room" with 200
    And user "owner" promotes "moderator" in room "public room" with 200
    And user "owner" adds "invited user" to room "public room" with 200
    And user "not invited but joined user" joins room "public room" with 200
    And user "guest moderator" joins room "public room" with 200
    And user "owner" promotes "guest moderator" in room "public room" with 200
    And user "guest" joins room "public room" with 200
    When user "moderator" sets avatar for room "public room" from file "data/green-square-256.png"
    Then user "owner" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "moderator" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "invited user" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "not invited but joined user" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "guest moderator" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "guest" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"

  Scenario: guest moderator can set avatar in public room
    Given user "owner" creates room "public room"
      | roomType | 3 |
      | roomName | room |
    And user "owner" adds "moderator" to room "public room" with 200
    And user "owner" promotes "moderator" in room "public room" with 200
    And user "owner" adds "invited user" to room "public room" with 200
    And user "not invited but joined user" joins room "public room" with 200
    And user "guest moderator" joins room "public room" with 200
    And user "owner" promotes "guest moderator" in room "public room" with 200
    And user "guest" joins room "public room" with 200
    When user "guest moderator" sets avatar for room "public room" from file "data/green-square-256.png"
    Then user "owner" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "moderator" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "invited user" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "not invited but joined user" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "guest moderator" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "guest" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"

  Scenario: others can not set avatar in public room
    Given user "owner" creates room "public room"
      | roomType | 3 |
      | roomName | room |
    And user "owner" adds "moderator" to room "public room" with 200
    And user "owner" promotes "moderator" in room "public room" with 200
    And user "owner" adds "invited user" to room "public room" with 200
    And user "not invited but joined user" joins room "public room" with 200
    And user "guest moderator" joins room "public room" with 200
    And user "owner" promotes "guest moderator" in room "public room" with 200
    And user "guest" joins room "public room" with 200
    When user "invited user" sets avatar for room "public room" from file "data/green-square-256.png" with 403
    And user "not invited but joined user" sets avatar for room "public room" from file "data/green-square-256.png" with 404
    And user "not joined user" sets avatar for room "public room" from file "data/green-square-256.png" with 404
    And user "guest" sets avatar for room "public room" from file "data/green-square-256.png" with 404
    # Guest user names in tests must being with "guest"
    And user "guest not joined" sets avatar for room "public room" from file "data/green-square-256.png" with 404
    Then user "owner" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"
    And user "moderator" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"
    And user "invited user" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"
    And user "not invited but joined user" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"
    And user "guest moderator" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"
    And user "guest" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"



  Scenario: participants can not set avatar in room for a share
    # These users are only needed in very specific tests, so they are not
    # created in the background step.
    Given user "owner of file" exists
    And user "user with access to file" exists
    And user "owner of file" shares "welcome.txt" with user "user with access to file" with OCS 100
    And user "user with access to file" accepts last share
    And user "owner of file" shares "welcome.txt" by link with OCS 100
    And user "guest" gets the room for last share with 200
    And user "owner of file" joins room "file last share room" with 200
    And user "user with access to file" joins room "file last share room" with 200
    And user "guest" joins room "file last share room" with 200
    When user "owner of file" sets avatar for room "file last share room" from file "data/green-square-256.png" with 404
    And user "user with access to file" sets avatar for room "file last share room" from file "data/green-square-256.png" with 404
    And user "guest" sets avatar for room "file last share room" from file "data/green-square-256.png" with 404
    Then user "owner of file" gets avatar for room "group room"
    And last avatar is a default avatar of size "128"
    And user "user with access to file" gets avatar for room "group room"
    And last avatar is a default avatar of size "128"
    And user "guest" gets avatar for room "group room"
    And last avatar is a default avatar of size "128"



  Scenario: participants can not set avatar in a password request room
    # The user is only needed in very specific tests, so it is not created in
    # the background step.
    Given user "owner of file" exists
    And user "owner of file" shares "welcome.txt" by link with OCS 100
      | password | 123456 |
      | sendPasswordByTalk | true |
    And user "guest" creates the password request room for last share with 201
    And user "guest" joins room "password request for last share room" with 200
    And user "owner of file" joins room "password request for last share room" with 200
    When user "owner of file" sets avatar for room "file last share room" from file "data/green-square-256.png" with 404
    And user "guest" sets avatar for room "file last share room" from file "data/green-square-256.png" with 404
    Then user "owner of file" gets avatar for room "group room"
    And last avatar is a default avatar of size "128"
    And user "guest" gets avatar for room "group room"
    And last avatar is a default avatar of size "128"



  Scenario: set non squared image as generic user avatar
    Given user "owner" creates room "group room"
      | roomType | 2 |
      | roomName | room |
    When user "user0" sets avatar for room "group room" from file "data/green-rectangle-256-128.png" with 400
    Then user "user0" gets avatar for room "group room"
    And last avatar is a default avatar of size "128"

  Scenario: set not an image as generic user avatar
    Given user "owner" creates room "group room"
      | roomType | 2 |
      | roomName | room |
    When user "user0" sets avatar for room "group room" from file "data/textfile.txt" with 400
    Then user "user0" gets avatar for room "group room"
    And last avatar is a default avatar of size "128"



  Scenario: owner can delete avatar in group room
    Given user "owner" creates room "group room"
      | roomType | 2 |
      | roomName | room |
    And user "owner" adds "moderator" to room "group room" with 200
    And user "owner" promotes "moderator" in room "group room" with 200
    And user "owner" adds "invited user" to room "group room" with 200
    And user "owner" sets avatar for room "group room" from file "data/green-square-256.png"
    And user "owner" gets avatar for room "group room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    Then user "owner" gets avatar for room "group room"
    And last avatar is a default avatar of size "128"
    And user "moderator" gets avatar for room "group room"
    And last avatar is a default avatar of size "128"
    And user "invited user" gets avatar for room "group room"
    And last avatar is a default avatar of size "128"

  Scenario: moderator can delete avatar in group room
    Given user "owner" creates room "group room"
      | roomType | 2 |
      | roomName | room |
    And user "owner" adds "moderator" to room "group room" with 200
    And user "owner" promotes "moderator" in room "group room" with 200
    And user "owner" adds "invited user" to room "group room" with 200
    And user "owner" sets avatar for room "group room" from file "data/green-square-256.png"
    And user "owner" gets avatar for room "group room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    When user "moderator" deletes avatar for room "group room"
    Then user "owner" gets avatar for room "group room"
    And last avatar is a default avatar of size "128"
    And user "moderator" gets avatar for room "group room"
    And last avatar is a default avatar of size "128"
    And user "invited user" gets avatar for room "group room"
    And last avatar is a default avatar of size "128"

  Scenario: others can not delete avatar in group room
    Given user "owner" creates room "group room"
      | roomType | 2 |
      | roomName | room |
    And user "owner" adds "moderator" to room "group room" with 200
    And user "owner" promotes "moderator" in room "group room" with 200
    And user "owner" adds "invited user" to room "group room" with 200
    And user "owner" sets avatar for room "group room" from file "data/green-square-256.png"
    When user "invited user" deletes avatar for room "group room" with 403
    And user "not invited user" deletes avatar for room "group room" with 404
    # Guest user names in tests must being with "guest"
    And user "guest not joined" deletes avatar for room "group room" with 404
    Then user "owner" gets avatar for room "group room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "moderator" gets avatar for room "group room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "invited user" gets avatar for room "group room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"



  Scenario: owner can delete avatar in public room
    Given user "owner" creates room "public room"
      | roomType | 3 |
      | roomName | room |
    And user "owner" adds "moderator" to room "public room" with 200
    And user "owner" promotes "moderator" in room "public room" with 200
    And user "owner" adds "invited user" to room "public room" with 200
    And user "not invited but joined user" joins room "public room" with 200
    And user "guest moderator" joins room "public room" with 200
    And user "owner" promotes "guest moderator" in room "public room" with 200
    And user "guest" joins room "public room" with 200
    And user "owner" sets avatar for room "public room" from file "data/green-square-256.png"
    And user "owner" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    When user "owner" deletes avatar for room "public room"
    Then user "owner" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"
    And user "moderator" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"
    And user "invited user" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"
    And user "not invited but joined user" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"
    And user "guest moderator" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"
    And user "guest" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"

  Scenario: moderator can delete avatar in public room
    Given user "owner" creates room "public room"
      | roomType | 3 |
      | roomName | room |
    And user "owner" adds "moderator" to room "public room" with 200
    And user "owner" promotes "moderator" in room "public room" with 200
    And user "owner" adds "invited user" to room "public room" with 200
    And user "not invited but joined user" joins room "public room" with 200
    And user "guest moderator" joins room "public room" with 200
    And user "owner" promotes "guest moderator" in room "public room" with 200
    And user "guest" joins room "public room" with 200
    And user "owner" sets avatar for room "public room" from file "data/green-square-256.png"
    And user "owner" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    When user "moderator" deletes avatar for room "public room"
    Then user "owner" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"
    And user "moderator" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"
    And user "invited user" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"
    And user "not invited but joined user" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"
    And user "guest moderator" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"
    And user "guest" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"

  Scenario: guest moderator can delete avatar in public room
    Given user "owner" creates room "public room"
      | roomType | 3 |
      | roomName | room |
    And user "owner" adds "moderator" to room "public room" with 200
    And user "owner" promotes "moderator" in room "public room" with 200
    And user "owner" adds "invited user" to room "public room" with 200
    And user "not invited but joined user" joins room "public room" with 200
    And user "guest moderator" joins room "public room" with 200
    And user "owner" promotes "guest moderator" in room "public room" with 200
    And user "guest" joins room "public room" with 200
    And user "owner" sets avatar for room "public room" from file "data/green-square-256.png"
    And user "owner" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    When user "guest moderator" deletes avatar for room "public room"
    Then user "owner" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"
    And user "moderator" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"
    And user "invited user" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"
    And user "not invited but joined user" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"
    And user "guest moderator" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"
    And user "guest" gets avatar for room "public room"
    And last avatar is a default avatar of size "128"

  Scenario: others can not delete avatar in public room
    Given user "owner" creates room "public room"
      | roomType | 3 |
      | roomName | room |
    And user "owner" adds "moderator" to room "public room" with 200
    And user "owner" promotes "moderator" in room "public room" with 200
    And user "owner" adds "invited user" to room "public room" with 200
    And user "not invited but joined user" joins room "public room" with 200
    And user "guest moderator" joins room "public room" with 200
    And user "owner" promotes "guest moderator" in room "public room" with 200
    And user "guest" joins room "public room" with 200
    And user "owner" sets avatar for room "public room" from file "data/green-square-256.png"
    When user "invited user" deletes avatar for room "public room" with 403
    And user "not invited but joined user" deletes avatar for room "public room" with 404
    And user "not joined user" deletes avatar for room "public room" with 404
    And user "guest" deletes avatar for room "public room" with 404
    # Guest user names in tests must being with "guest"
    And user "guest not joined" deletes avatar for room "public room" with 404
    Then user "owner" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "moderator" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "invited user" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "not invited but joined user" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "guest moderator" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"
    And user "guest" gets avatar for room "public room" with size "256"
    And last avatar is a custom avatar of size "256" and color "#00FF00"



  Scenario: get room avatar with a larger size than the original one
    Given user "owner" creates room "group room"
      | roomType | 2 |
      | roomName | room |
    And user "user0" sets avatar for room "group room" from file "data/green-square-256.png"
    When user "user0" gets avatar for room "group room" with size "512"
    Then last avatar is a custom avatar of size "512" and color "#00FF00"

  Scenario: get room avatar with a smaller size than the original one
    Given user "owner" creates room "group room"
      | roomType | 2 |
      | roomName | room |
    And user "user0" sets avatar for room "group room" from file "data/green-square-256.png"
    When user "user0" gets avatar for room "group room" with size "128"
    Then last avatar is a custom avatar of size "128" and color "#00FF00"
