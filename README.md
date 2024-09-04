# question-and-answer
[![coverage: 72%](./.readme-assets/coverage.svg)](https://github.com/liquid-labs/question-and-answer/pulls?q=is%3Apr+is%3Aclosed)

Library providing command-line question and answer functionality.

___This is an alpha project. The basic interface is stable, but there are some known issues and further testing required before the interface and behavior can be locked in entirely.___

## Installation

```bash
npm i question-and-answer
```

## Usage

### Library usage

```javascript
import { Questioner } from 'question-and-answer'

const interrogationBundle = {
  "actions": [
    { "statement": "Let us know your thoughts!" },
    { 
      "prompt": "What are your 2 or 3 favorite colors?",
      "multiValue": true,
      "parameter": "FAVORITE_COLOR",
      "validations": {
        "min-count": 2,
        "max-count": 3
      }
    },
    {
      "prompt": "What's your favorite integer number?",
      "type": "integer",
      "parameter": "FAVORITE_NUMBER"
    },
    { 
      "prompt": "Which is best?",
      "options": [ "love", "honor", "justice" ],
      "parameter": "BEST_VIRTUE"
    },
    {
      "maps": [
        { "source": "FAVORITE_NUMBER > 99", "parameter": "GT100", "type": "boolean" },
        { "source": "FAVORITE_NUMBER * 2", "parameter": "TWOX", "type": "integer" }
      ]
    },
    { "review": "questions" }
  ]
}

const questioner = new Questioner({ interrogationBundle })
await questioner.question()

console.log(`Favorite color: ${questioner.get('FAVORITE_COLOR')}`)
console.log(`Best virtue: ${questioner.get('BEST_VIRTUE')}`)
```

### CLI usage

```bash
npx qna path/to/interrogation-bundle.json
```

The CLI is intended mainly a way to test/demonstraite interrogation bundles.

## User's Guide

### Interrogation bundle format

- The bundle defines an array of _actions_.
- Each _action_ is either a _question_, _map_, _statement_, or _review_.
- A _question_ asks the user a question and sets a parameter based on the answer.
- A _map_ maps existing parameters to a new parameter based on a [condition-eval](https://github.com/liquid-labs/condition-eval) string or literal value.
  - A non-literal mapping must specify either a 'boolean', 'integer', or 'numeric' type.
- A _statement_ displays text to the user.
- A review initiates a review of previously set questions not already reviewed.[*](#review-note)
- Each _action_ has exactly one of the following fields, which defines its type:
  - "prompt": for _question_ type actions,
  - "statement": displays the _statement_ value,
  - "maps": defines an array of _maps_,
  - "review": triggers a _review_ of either "all" or "questions".
- Any _action_ may define an optional "condition" string, evaluated accordig to [condition-eval](https://github.com/liquid-labs/condition-eval)
- Each parameter setting _action_ (_question_ or _map_) defines:
  - exactly one "parameter" string,
  - an optional "type" string of "bool", "boolean", "int", "intefer", "float", "numeric", or "string" (default)
  - an optional "noSkipDefined" parameter which, if true, will execute the _action_ even if the named "parameter" is defined
- Each _question_ defines:
  - exactly one "prompt" string,
  - an optional "default" value,
  - an optional "options" array of strings,
  - an optional "multiValue" boolean,
  - an optional "elseSource"; the value is a parameter name whose value is used to set the "parameter" if the "condition" fails
  - optional _validations_ object; see the [validations](#validations) section
- each _map_ entry defines one of:
  - an optional "source" a [condition-eval](https://github.com/liquid-labs/condition-eval) statement, or
  - an optional "value" a literal value
  - optional _validations_ object; see the [validations](#validations) section
- a _review_ may have a value of "questions", "maps", or "all"

### Interrogation flow

1. Each _action_ is evaluated in order.
2. We determine whether an action is skipped:
   - If present, the "condition" is evaluated and the _action_ is skipped unless the "condition" evalutaess truthy.
   - _Question_ and _map_ actions are skipped (even if "condition" is truthy) if the "parameter" value is already defined unless "noSkipDefined" is set `true` for the _action_ or the _Questioner_.
3. Non-skipped actions are executed.
   - _Statements_ are displayed.
   - _Maps_ are calculated.
   - _Questions_ are asked.
   - _Reviews_ are performed.

"Asking a _question_" means:
1. A default value is determined by:
   1. The current value of the "parameter", if any.
   2. The value of the "default" field.
2. The question is displayed (either free-form or by displaying the selectable, numbered "options").
   1. If there is a default value, it is displayed in the prompt and will be used if the user just hits &lt;ENTER&gt; with no other input.
   2. If there are any _requirements_, they are evaluated against the answer and teh question is re-asked until the _requirements_ are met.

"Performing a _review_" means:
1. Determine the values to review.
   1. Any previously reviewed value is excluded.[*](#review-note)
   2. A 'questions' review reviews only _question_ values whereas an 'all' reviews _qusetion_ and _map_ values.
2. Display the values, in order, with the option to accept (hit &lt;ENTER&gt;) or change the value.

To change a default value to literal nothing (empty string, null value), enter '-'. This "clears" the current value.

<span id="review-note">*Review note:</span> the review does not currently skip previously reviewed items as it should. This is a [known issue](https://github.com/liquid-labs/question-and-answer/issues/75).

### Validations

You can require a specific number of answers for multi-value answers, and perform arbitrary validation checks on the string values. Validations are performed using the [specify-string](https://github.com/liquid-labs/specify-string) library. Please refer to the project documentation for complete details on validations. The `validations` object is passed into the `validateString` function as the validation `spec`. If provided, the optional `validators` parameter passed in the `Questioner` constructor is passed to `validateString`.

### Examples

- A [simple question](./samples/simple-question.json), rendering a free-form answer.
- A [question with limited options](./sample/simple-options.json), which will render a selection prompt.
- A freeform [multi-value question](./sample/multi-value.json) requiring between 2 and 3 answers.